import { Prisma } from "@prisma/client";
import { mapValues } from "remeda";
import { v5 as uuidv5 } from "uuid";

import {
  clickhouseClient,
  ClickHouseQueryBuilder,
  createClickhouseClient,
  getChCompatibleUuid,
} from "../clickhouse";
import { getSubscribedSegments } from "../journeys";
import logger from "../logger";
import prisma from "../prisma";
import {
  ComputedPropertyPeriod,
  JourneyResource,
  SavedIntegrationResource,
  SavedSegmentResource,
  SavedUserPropertyResource,
  UserPropertyDefinitionType,
} from "../types";

// TODO pull out into separate files
export async function createTables() {
  const queries: string[] = [
    `
      CREATE TABLE IF NOT EXISTS user_events_v2 (
        event_type Enum(
          'identify' = 1,
          'track' = 2,
          'page' = 3,
          'screen' = 4,
          'group' = 5,
          'alias' = 6
        ) DEFAULT JSONExtract(
          message_raw,
          'type',
          'Enum(\\'identify\\' = 1, \\'track\\' = 2, \\'page\\' = 3, \\'screen\\' = 4, \\'group\\' = 5, \\'alias\\' = 6)'
        ),
        event String DEFAULT JSONExtract(
          message_raw,
          'event',
          'String'
        ),
        event_time DateTime64 DEFAULT assumeNotNull(
          parseDateTime64BestEffortOrNull(
            JSONExtractString(message_raw, 'timestamp'),
            3
          )
        ),
        message_id String,
        user_id String DEFAULT JSONExtract(
          message_raw,
          'userId',
          'String'
        ),
        anonymous_id String DEFAULT JSONExtract(
          message_raw,
          'anonymousId',
          'String'
        ),
        user_or_anonymous_id String DEFAULT assumeNotNull(
          coalesce(
            JSONExtract(message_raw, 'userId', 'Nullable(String)'),
            JSONExtract(message_raw, 'anonymousId', 'Nullable(String)')
          )
        ),
        properties String DEFAULT assumeNotNull(
          coalesce(
            JSONExtract(message_raw, 'traits', 'Nullable(String)'),
            JSONExtract(message_raw, 'properties', 'Nullable(String)')
          )
        ),
        processing_time DateTime64(3) DEFAULT now64(3),
        message_raw String,
        workspace_id String
      )
      ENGINE = MergeTree()
      ORDER BY (
        workspace_id,
        processing_time,
        user_or_anonymous_id,
        event_time,
        message_id
    );
    `,
    `
      CREATE TABLE IF NOT EXISTS computed_property_state (
        workspace_id LowCardinality(String),
        type Enum('user_property' = 1, 'segment' = 2),
        computed_property_id LowCardinality(String),
        state_id LowCardinality(String),
        user_id String,
        last_value AggregateFunction(argMax, String, DateTime64(3)),
        unique_count AggregateFunction(uniq, String),
        max_event_time AggregateFunction(max, DateTime64(3)),
        computed_at DateTime64(3)
      )
      ENGINE = AggregatingMergeTree()
      ORDER BY (
        workspace_id,
        type,
        computed_property_id,
        state_id,
        user_id
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS computed_property_assignments_v2 (
        workspace_id LowCardinality(String),
        type Enum('user_property' = 1, 'segment' = 2),
        computed_property_id LowCardinality(String),
        user_id String,
        segment_value Boolean,
        user_property_value String,
        max_event_time DateTime64(3),
        assigned_at DateTime64(3) DEFAULT now64(3),
      )
      ENGINE = ReplacingMergeTree()
      ORDER BY (
        workspace_id,
        type,
        computed_property_id,
        user_id
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS processed_computed_properties_v2 (
        workspace_id LowCardinality(String),
        user_id String,
        type Enum('user_property' = 1, 'segment' = 2),
        computed_property_id LowCardinality(String),
        processed_for LowCardinality(String),
        processed_for_type LowCardinality(String),
        segment_value Boolean,
        user_property_value String,
        max_event_time DateTime64(3), 
        processed_at DateTime64(3) DEFAULT now64(3),
      )
      ENGINE = ReplacingMergeTree()
      ORDER BY (
        workspace_id,
        type,
        computed_property_id,
        user_id
      );
    `,
    `
      create table updated_computed_property_state(
        workspace_id LowCardinality(String),
        type Enum('user_property' = 1, 'segment' = 2),
        computed_property_id LowCardinality(String),
        state_id LowCardinality(String),
        user_id String,
        computed_at DateTime64(3)
      ) Engine=MergeTree
      partition by toYYYYMMDD(computed_at)
      order by computed_at
      TTL toStartOfDay(computed_at) + interval 100 day;
    `,
    `
      create table if not exists updated_property_assignments_v2(
        workspace_id LowCardinality(String),
        type Enum('user_property' = 1, 'segment' = 2),
        computed_property_id LowCardinality(String),
        user_id String,
        assigned_at DateTime64(3)
      ) Engine=MergeTree
      partition by toYYYYMMDD(assigned_at)
      order by assigned_at
      TTL toStartOfDay(assigned_at) + interval 100 day;
    `,
  ];

  await Promise.all(
    queries.map((query) =>
      clickhouseClient().command({
        query,
        clickhouse_settings: { wait_end_of_query: 1 },
      })
    )
  );
  const mvQueries = [
    `
      create materialized view updated_property_assignments_v2_mv to updated_property_assignments_v2
      as select
        workspace_id,
        type,
        computed_property_id,
        user_id,
        assigned_at
      from computed_property_assignments_v2
      group by
        workspace_id,
        type,
        computed_property_id,
        user_id,
        assigned_at;
    `,
    `
      create materialized view updated_computed_property_state_mv to updated_computed_property_state
      as select
        workspace_id,
        type,
        computed_property_id,
        state_id,
        user_id,
        computed_at
      from computed_property_state
      group by
        workspace_id,
        type,
        computed_property_id,
        state_id,
        user_id,
        computed_at;
    `,
  ];

  await Promise.all(
    mvQueries.map((query) =>
      clickhouseClient().command({
        query,
        clickhouse_settings: { wait_end_of_query: 1 },
      })
    )
  );
  console.log("createTables done", queries);
}

export async function dropTables() {
  const queries: string[] = [
    `
      DROP TABLE IF EXISTS user_events_v2;
    `,
    `
      DROP TABLE IF EXISTS computed_property_state;
    `,
    `
      DROP TABLE IF EXISTS computed_property_assignments_v2;
    `,
    `
      DROP TABLE IF EXISTS processed_computed_properties_v2;
    `,
    `
      DROP TABLE IF EXISTS updated_computed_property_state;
    `,
    `
      DROP TABLE IF EXISTS updated_computed_property_state_mv;
    `,
    `
      DROP TABLE IF EXISTS updated_property_assignments_v2;
    `,
    `
      DROP TABLE IF EXISTS updated_property_assignments_v2_mv;
    `,
  ];

  await Promise.all(
    queries.map((query) =>
      clickhouseClient().command({
        query,
        clickhouse_settings: { wait_end_of_query: 1 },
      })
    )
  );
}

interface SubQueryData {
  condition: string;
  type: "user_property" | "segment";
  computedPropertyId: string;
  stateId: string;
  argMaxValue?: string;
  uniqValue?: string;
}

type AggregatedComputedPropertyPeriod = Omit<
  ComputedPropertyPeriod,
  "from" | "workspaceId" | "to"
> & {
  maxTo: ComputedPropertyPeriod["to"];
};

enum ComputedPropertyStep {
  ComputeState = "ComputeState",
  WriteAssignments = "WriteAssignments",
  ProcessAssignments = "ProcessAssignments",
}

export async function computeState({
  workspaceId,
  segments,
  userProperties,
  now,
}: {
  workspaceId: string;
  // timestamp in ms
  now: number;
  segments: SavedSegmentResource[];
  userProperties: SavedUserPropertyResource[];
}) {
  const qb = new ClickHouseQueryBuilder();
  // TODO implement pagination
  const subQueryData: SubQueryData[] = [];

  for (const segment of segments) {
  }

  for (const userProperty of userProperties) {
    let subQuery: SubQueryData;
    switch (userProperty.definition.type) {
      case UserPropertyDefinitionType.Trait: {
        const stateId = uuidv5(
          userProperty.updatedAt.toString(),
          userProperty.id
        );
        subQuery = {
          condition: `(visitParamExtractString(properties, 'email') as email) != ''`,
          type: "user_property",
          uniqValue: "''",
          argMaxValue: "email",
          computedPropertyId: userProperty.id,
          stateId,
        };
        break;
      }
      default:
        throw new Error(
          `Unhandled user property type: ${userProperty.definition.type}`
        );
    }
    subQueryData.push(subQuery);
  }
  if (subQueryData.length === 0) {
    return;
  }

  const periodsQuery = Prisma.sql`
    SELECT DISTINCT ON ("workspaceId", "type", "computedPropertyId")
      "type",
      "computedPropertyId",
      "version",
      MAX("to") OVER (PARTITION BY "workspaceId", "type", "computedPropertyId") as "maxTo"
    FROM "ComputedPropertyPeriod"
    WHERE
      "workspaceId" = CAST(${workspaceId} AS UUID)
      AND "step" = ${ComputedPropertyStep.ComputeState}
    ORDER BY "workspaceId", "type", "computedPropertyId", "to" DESC;
  `;
  const periods = await prisma().$queryRaw<AggregatedComputedPropertyPeriod[]>(
    periodsQuery
  );

  const periodByComputedPropertyId = periods.reduce<
    Map<
      string,
      Pick<
        AggregatedComputedPropertyPeriod,
        "maxTo" | "computedPropertyId" | "version"
      >
    >
  >((acc, period) => {
    const { maxTo } = period;
    acc.set(period.computedPropertyId, {
      maxTo,
      computedPropertyId: period.computedPropertyId,
      version: period.version,
    });
    return acc;
  }, new Map());

  const subQueriesWithPeriods = subQueryData.reduce<
    Record<number, SubQueryData[]>
  >((memo, subQuery) => {
    const period =
      periodByComputedPropertyId.get(subQuery.computedPropertyId) ?? null;
    const periodKey = period?.maxTo.getTime() ?? 0;
    const subQueriesForPeriod = memo[periodKey] ?? [];
    memo[periodKey] = [...subQueriesForPeriod, subQuery];
    return memo;
  }, {});

  const nowSeconds = now / 1000;
  const queries = Object.values(
    mapValues(subQueriesWithPeriods, (periodSubQueries, period) => {
      const lowerBoundClause =
        period !== 0
          ? `and processing_time >= toDateTime64(${period / 1000}, 3)`
          : ``;

      const subQueries = periodSubQueries
        .map(
          (subQuery) => `
            if(
              ${subQuery.condition},
              (
                '${subQuery.type}',
                '${subQuery.computedPropertyId}',
                '${subQuery.stateId}',
                ${subQuery.argMaxValue},
                ${subQuery.uniqValue}
              ),
              (Null, Null, Null, Null, Null)
            )
          `
        )
        .join(", ");

      const query = `
        insert into computed_property_state
        select
          workspace_id,
          (
            arrayJoin(
              arrayFilter(
                v -> not(isNull(v.1)),
                [${subQueries}]
              )
            ) as c
          ).1 as type,
          c.2 as computed_property_id,
          c.3 as state_id,
          user_id,
          argMaxState(ifNull(c.4, ''), event_time) as last_value,
          uniqState(ifNull(c.5, '')) as unique_count,
          maxState(event_time) as max_event_time,
          now64(3) as computed_at
        from user_events_v2
        where
          workspace_id = ${qb.addQueryValue(workspaceId, "String")}
          and processing_time < toDateTime64(${nowSeconds}, 3)
          ${lowerBoundClause}
        group by
          workspace_id,
          type,
          computed_property_id,
          state_id,
          user_id,
          processing_time;
      `;
      return clickhouseClient().command({
        query,
        query_params: qb.getQueries(),
      });
    })
  );
  await Promise.all(queries);
  // fixme write step
}

export async function computeAssignments({
  workspaceId,
  userProperties,
}: {
  workspaceId: string;
  userProperties: SavedUserPropertyResource[];
  segments: SavedSegmentResource[];
}): Promise<void> {
  const qb = new ClickHouseQueryBuilder();
  const queryies: Promise<unknown>[] = [];
  // FIXME get period
  for (const userProperty of userProperties) {
    let query: string;
    switch (userProperty.definition.type) {
      case UserPropertyDefinitionType.Trait: {
        const stateId = uuidv5(
          userProperty.updatedAt.toString(),
          userProperty.id
        );
        query = `
          insert into computed_property_assignments_v2
          select
            workspace_id,
            type,
            computed_property_id,
            user_id,
            False as segment_value,
            argMaxMerge(last_value) as user_property_value,
            maxMerge(max_event_time) as max_event_time,
            now64(3) as assigned_at
          from computed_property_state
          where
            (
              workspace_id,
              type,
              computed_property_id,
              state_id,
              user_id
            ) in (
              select
                workspace_id,
                type,
                computed_property_id,
                state_id,
                user_id
              from updated_computed_property_state
              where
                workspace_id = ${qb.addQueryValue(workspaceId, "String")}
                and type = 'user_property'
                and computed_property_id = ${qb.addQueryValue(
                  userProperty.id,
                  "String"
                )}
                and state_id = ${qb.addQueryValue(stateId, "String")}
            )
          group by
            workspace_id,
            type,
            computed_property_id,
            user_id;
        `;
        break;
      }
      default:
        throw new Error(
          `Unhandled user property type: ${userProperty.definition.type}`
        );
    }
    queryies.push(
      clickhouseClient().command({ query, query_params: qb.getQueries() })
    );
  }
  await Promise.all(queryies);
  // fixme write step
}

export interface ComputedPropertyAssignment {
  workspace_id: string;
  type: "segment" | "user_property";
  computed_property_id: string;
  user_id: string;
  segment_value: boolean;
  user_property_value: string;
  max_event_time: string;
  assigned_at: string;
}

export async function processAssignments({
  workspaceId,
  userProperties,
  segments,
  integrations,
  journeys,
}: {
  workspaceId: string;
  userProperties: SavedUserPropertyResource[];
  segments: SavedSegmentResource[];
  integrations: SavedIntegrationResource[];
  journeys: JourneyResource[];
}): Promise<void> {
  // segment id / pg + journey id
  const subscribedJourneyMap = journeys.reduce<Map<string, Set<string>>>(
    (memo, j) => {
      const subscribedSegments = getSubscribedSegments(j.definition);

      subscribedSegments.forEach((segmentId) => {
        const processFor = memo.get(segmentId) ?? new Set();
        processFor.add(j.id);
        memo.set(segmentId, processFor);
      });
      return memo;
    },
    new Map()
  );

  const subscribedIntegrationUserPropertyMap = integrations.reduce<
    Map<string, Set<string>>
  >((memo, integration) => {
    integration.definition.subscribedUserProperties.forEach(
      (userPropertyName) => {
        const userPropertyId = userProperties.find(
          (up) => up.name === userPropertyName
        )?.id;
        if (!userPropertyId) {
          logger().info(
            { workspaceId, integration, userPropertyName },
            "integration subscribed to user property that doesn't exist"
          );
          return;
        }
        const processFor = memo.get(userPropertyId) ?? new Set();
        processFor.add(integration.name);
        memo.set(userPropertyId, processFor);
      }
    );
    return memo;
  }, new Map());

  const subscribedIntegrationSegmentMap = integrations.reduce<
    Map<string, Set<string>>
  >((memo, integration) => {
    integration.definition.subscribedSegments.forEach((segmentName) => {
      const segmentId = segments.find((s) => s.name === segmentName)?.id;
      if (!segmentId) {
        logger().info(
          { workspaceId, integration, segmentName },
          "integration subscribed to segment that doesn't exist"
        );
        return;
      }
      const processFor = memo.get(segmentId) ?? new Set();
      processFor.add(integration.name);
      memo.set(segmentId, processFor);
    });
    return memo;
  }, new Map());

  const subscribedJourneyKeys: string[] = [];
  const subscribedJourneyValues: string[][] = [];
  const subscribedIntegrationUserPropertyKeys: string[] = [];
  const subscribedIntegrationUserPropertyValues: string[][] = [];
  const subscribedIntegrationSegmentKeys: string[] = [];
  const subscribedIntegrationSegmentValues: string[][] = [];

  for (const [segmentId, journeySet] of Array.from(subscribedJourneyMap)) {
    subscribedJourneyKeys.push(segmentId);
    subscribedJourneyValues.push(Array.from(journeySet));
  }

  for (const [segmentId, integrationSet] of Array.from(
    subscribedIntegrationSegmentMap
  )) {
    subscribedIntegrationSegmentKeys.push(segmentId);
    subscribedIntegrationSegmentValues.push(Array.from(integrationSet));
  }

  for (const [userPropertyId, integrationSet] of Array.from(
    subscribedIntegrationUserPropertyMap
  )) {
    subscribedIntegrationUserPropertyKeys.push(userPropertyId);
    subscribedIntegrationUserPropertyValues.push(Array.from(integrationSet));
  }

  const qb = new ClickHouseQueryBuilder();

  const subscribedJourneysKeysQuery = qb.addQueryValue(
    subscribedJourneyKeys,
    "Array(String)"
  );

  const subscribedJourneysValuesQuery = qb.addQueryValue(
    subscribedJourneyValues,
    "Array(Array(String))"
  );

  const subscribedIntegrationsUserPropertyKeysQuery = qb.addQueryValue(
    subscribedIntegrationUserPropertyKeys,
    "Array(String)"
  );

  const subscribedIntegrationsUserPropertyValuesQuery = qb.addQueryValue(
    subscribedIntegrationUserPropertyValues,
    "Array(Array(String))"
  );

  const subscribedIntegrationsSegmentKeysQuery = qb.addQueryValue(
    subscribedIntegrationSegmentKeys,
    "Array(String)"
  );

  const subscribedIntegrationsSegmentValuesQuery = qb.addQueryValue(
    subscribedIntegrationSegmentValues,
    "Array(Array(String))"
  );

  const workspaceIdParam = qb.addQueryValue(workspaceId, "String");

  const tmpTableName = `computed_properties_to_process_${getChCompatibleUuid()}`;
  /**
   * This query is a bit complicated, so here's a breakdown of what it does:
   *
   * 1. It reads all the computed property assignments for the workspace.
   * 2. It joins the computed property assignments with the processed computed
   * properties table to filter out assignments that have already been
   * processed.
   * 3. It filters out "empty assignments" (assignments where the user property
   * value is empty, or the segment value is false) if the property has not
   * already been assigned.
   * 4. It filters out false segment assignments to journeys.
   */
  const query = `
    CREATE TEMPORARY TABLE IF NOT EXISTS ${tmpTableName} AS
    SELECT
      cpa.workspace_id,
      cpa.type,
      cpa.computed_property_id,
      cpa.user_id,
      cpa.latest_segment_value,
      cpa.latest_user_property_value,
      cpa.max_assigned_at,
      cpa.processed_for,
      cpa.processed_for_type
    FROM (
      SELECT
          workspace_id,
          type,
          computed_property_id,
          user_id,
          argMax(segment_value, assigned_at) latest_segment_value,
          argMax(user_property_value, assigned_at) latest_user_property_value,
          max(assigned_at) max_assigned_at,
          arrayJoin(
              arrayConcat(
                  if(
                      type = 'segment' AND indexOf(${subscribedJourneysKeysQuery}, computed_property_id) > 0,
                      arrayMap(i -> ('journey', i), arrayElement(${subscribedJourneysValuesQuery}, indexOf(${subscribedJourneysKeysQuery}, computed_property_id))),
                      []
                  ),
                  if(
                      type = 'user_property' AND indexOf(${subscribedIntegrationsUserPropertyKeysQuery}, computed_property_id) > 0,
                      arrayMap(i -> ('integration', i), arrayElement(${subscribedIntegrationsUserPropertyValuesQuery}, indexOf(${subscribedIntegrationsUserPropertyKeysQuery}, computed_property_id))),
                      []
                  ),
                  if(
                      type = 'segment' AND indexOf(${subscribedIntegrationsSegmentKeysQuery}, computed_property_id) > 0,
                      arrayMap(i -> ('integration', i), arrayElement(${subscribedIntegrationsSegmentValuesQuery}, indexOf(${subscribedIntegrationsSegmentKeysQuery}, computed_property_id))),
                      []
                  ),
                  [('pg', 'pg')]
              )
          ) as processed,
          processed.1 as processed_for_type,
          processed.2 as processed_for
      FROM computed_property_assignments_v2
      WHERE workspace_id = ${workspaceIdParam}
      GROUP BY
          workspace_id,
          type,
          computed_property_id,
          user_id
    ) cpa
    LEFT JOIN (
      SELECT
        workspace_id,
        computed_property_id,
        user_id,
        processed_for_type,
        processed_for,
        argMax(segment_value, processed_at) segment_value,
        argMax(user_property_value, processed_at) user_property_value
      FROM processed_computed_properties_v2
      GROUP BY
        workspace_id,
        computed_property_id,
        user_id,
        processed_for_type,
        processed_for
    ) pcp
    ON
      cpa.workspace_id = pcp.workspace_id AND
      cpa.computed_property_id = pcp.computed_property_id AND
      cpa.user_id = pcp.user_id AND
      cpa.processed_for = pcp.processed_for AND
      cpa.processed_for_type = pcp.processed_for_type
    WHERE (
      cpa.latest_user_property_value != pcp.user_property_value
      OR cpa.latest_segment_value != pcp.segment_value
    )
    AND (
        (
            cpa.type = 'user_property'
            AND cpa.latest_user_property_value != '""'
            AND cpa.latest_user_property_value != ''
        )
        OR (
            cpa.type = 'segment'
            AND cpa.latest_segment_value = true
        )
        OR (
            pcp.workspace_id != ''
            AND cpa.processed_for_type != 'journey'
        )
    )
  `;

  const ch = createClickhouseClient({
    enableSession: true,
  });

  await ch.command({
    query,
    query_params: qb.getQueries(),
    clickhouse_settings: { wait_end_of_query: 1 },
  });
}
