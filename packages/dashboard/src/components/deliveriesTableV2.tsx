import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Column,
  ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import axios from "axios";
import { unwrap } from "isomorphic-lib/src/resultHandling/resultUtils";
import { schemaValidateWithErr } from "isomorphic-lib/src/resultHandling/schemaValidation";
import { assertUnreachable } from "isomorphic-lib/src/typeAssertions";
import {
  BroadcastResource,
  ChannelType,
  CompletionStatus,
  SavedJourneyResource,
  SearchDeliveriesRequest,
  SearchDeliveriesResponse,
  SearchDeliveriesResponseItem,
  WorkspaceResource,
} from "isomorphic-lib/src/types";
import { useMemo } from "react";
import { useImmer } from "use-immer";

import { useAppStorePick } from "../lib/appStore";
import {
  defaultGetDeliveriesRequest,
  GetDeliveriesRequest,
} from "./deliveriesTable";

type SortBy =
  | "from"
  | "to"
  | "status"
  | "originName"
  | "templateName"
  | "sentAt";

type SortDirection = "asc" | "desc";

interface State {
  query: {
    cursor: string | null;
    limit: number;
    sortBy: SortBy;
    sortDirection: SortDirection;
  };
}
interface BaseDelivery {
  userId: string;
  body: string;
  status: string;
  originId: string;
  originType: "broadcast" | "journey";
  originName: string;
  templateId: string;
  templateName: string;
  sentAt: number;
  updatedAt: number;
  from?: string;
  to?: string;
  subject?: string;
  replyTo?: string;
  snippet?: string;
}

interface EmailDelivery extends BaseDelivery {
  channel: typeof ChannelType.Email;
  from: string;
  to: string;
  subject: string;
  replyTo?: string;
  snippet: string;
}

interface SmsDelivery extends BaseDelivery {
  channel: typeof ChannelType.Sms;
  from?: undefined;
  to: string;
  subject?: undefined;
  replyTo?: undefined;
  snippet: string;
}

interface WebhookDelivery extends BaseDelivery {
  channel: typeof ChannelType.Webhook;
  from?: undefined;
  to?: undefined;
  subject?: undefined;
  replyTo?: undefined;
  snippet?: undefined;
}

type Delivery = EmailDelivery | SmsDelivery | WebhookDelivery;

function getOrigin({
  workspace,
  journeys,
  broadcasts,
  item,
}: {
  workspace: WorkspaceResource;
  item: SearchDeliveriesResponseItem;
  journeys: SavedJourneyResource[];
  broadcasts: BroadcastResource[];
}): Pick<Delivery, "originId" | "originType" | "originName"> | null {
  for (const broadcast of broadcasts) {
    if (broadcast.journeyId === item.journeyId) {
      return {
        originId: broadcast.id,
        originType: "broadcast",
        originName: broadcast.name,
      };
    }
  }
  for (const journey of journeys) {
    if (journey.id === item.journeyId) {
      return {
        originId: journey.id,
        originType: "journey",
        originName: journey.name,
      };
    }
  }
  return null;
}

const columnHelper = createColumnHelper<Delivery>();

export function DeliveriesTableV2({
  getDeliveriesRequest = defaultGetDeliveriesRequest,
}: {
  getDeliveriesRequest?: GetDeliveriesRequest;
}) {
  const { workspace, apiBase, messages, journeys, broadcasts } =
    useAppStorePick([
      "workspace",
      "messages",
      "apiBase",
      "journeys",
      "broadcasts",
    ]);

  const [state, setState] = useImmer<State>({
    query: {
      cursor: null,
      limit: 10,
      sortBy: "sentAt",
      sortDirection: "desc",
    },
  });
  const query = useQuery<SearchDeliveriesResponse | null>({
    queryKey: ["deliveries", state],
    queryFn: async () => {
      if (workspace.type !== CompletionStatus.Successful) {
        return null;
      }
      const params: SearchDeliveriesRequest = {
        workspaceId: workspace.value.id,
      };
      const response = await getDeliveriesRequest({
        params,
        apiBase,
      });
      const result = unwrap(
        schemaValidateWithErr(response.data, SearchDeliveriesResponse),
      );
      return result;
    },
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<Delivery>[]>(
    () => [
      {
        header: "From",
        accessorKey: "from",
      },
      {
        header: "To",
        accessorKey: "to",
      },
    ],
    [],
  );
  const data = useMemo<Delivery[] | null>(() => {
    if (
      query.isPending ||
      !query.data ||
      workspace.type !== CompletionStatus.Successful ||
      journeys.type !== CompletionStatus.Successful ||
      messages.type !== CompletionStatus.Successful
    ) {
      return null;
    }
    return query.data.items.flatMap((item) => {
      const origin = getOrigin({
        workspace: workspace.value,
        journeys: journeys.value,
        broadcasts,
        item,
      });
      if (origin === null) {
        return [];
      }
      const template = messages.value.find(
        (message) => message.id === item.templateId,
      );
      if (template === undefined) {
        return [];
      }
      if (!("variant" in item)) {
        return [];
      }
      const { variant } = item;
      const baseDelivery: Omit<
        Delivery,
        "channel" | "body" | "snippet" | "subject" | "to" | "from" | "replyTo"
      > = {
        userId: item.userId,
        status: item.status,
        originId: origin.originId,
        originType: origin.originType,
        originName: origin.originName,
        templateId: template.id,
        templateName: template.name,
        sentAt: new Date(item.sentAt).getTime(),
        updatedAt: new Date(item.updatedAt).getTime(),
      };

      let delivery: Delivery;
      switch (variant.type) {
        case ChannelType.Email:
          delivery = {
            ...baseDelivery,
            channel: ChannelType.Email,
            body: variant.body,
            snippet: variant.subject,
            subject: variant.subject,
            to: variant.to,
            from: variant.from,
            replyTo: variant.replyTo,
          };
          break;
        case ChannelType.Sms:
          delivery = {
            ...baseDelivery,
            channel: ChannelType.Sms,
            body: variant.body,
            snippet: variant.body,
            to: variant.to,
          };
          break;
        case ChannelType.Webhook:
          delivery = {
            ...baseDelivery,
            channel: ChannelType.Webhook,
            body: JSON.stringify(
              { request: variant.request, response: variant.response },
              null,
              2,
            ),
          };
          break;
        default:
          assertUnreachable(variant);
      }
      return delivery;
    });
  }, [query, workspace, journeys, broadcasts, messages]);

  const table = useReactTable({
    columns: [],
    data: [],
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });
  if (query.isPending || data === null) {
    return <div>Loading...</div>;
  }
  return <div>DeliveriesTableV2</div>;
}
