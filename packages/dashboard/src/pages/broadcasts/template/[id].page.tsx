import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { getOrCreateBroadcast } from "backend-lib/src/broadcasts";
import { subscriptionGroupToResource } from "backend-lib/src/subscriptionGroups";
import { toUserPropertyResource } from "backend-lib/src/userProperties";
import { isChannelType } from "isomorphic-lib/src/channels";
import { CHANNEL_NAMES } from "isomorphic-lib/src/constants";
import { unwrap } from "isomorphic-lib/src/resultHandling/resultUtils";
import { assertUnreachable } from "isomorphic-lib/src/typeAssertions";
import {
  ChannelType,
  CompletionStatus,
  JourneyNodeType,
  MessageNode,
  MessageTemplateResource,
} from "isomorphic-lib/src/types";
import { GetServerSideProps, NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { validate } from "uuid";

import EmailEditor from "../../../components/messages/emailEditor";
import SubscriptionGroupAutocomplete from "../../../components/subscriptionGroupAutocomplete";
import { addInitialStateToProps } from "../../../lib/addInitialStateToProps";
import { getEmailEditorState } from "../../../lib/email";
import prisma from "../../../lib/prisma";
import { requestContext } from "../../../lib/requestContext";
import { AppState, PropsWithInitialState } from "../../../lib/types";
import { BroadcastLayout } from "../broadcastLayout";
import { getBroadcastAppState } from "../getBroadcastAppState";
import { useAppStorePick } from "../../../lib/appStore";
import { useState } from "react";

function getChannel(routeChannel: unknown): ChannelType {
  return typeof routeChannel === "string" && isChannelType(routeChannel)
    ? routeChannel
    : ChannelType.Email;
}

async function getChannelState({
  workspaceId,
  channel,
  template,
}: {
  template: MessageTemplateResource;
  workspaceId: string;
  channel: ChannelType;
}): Promise<Partial<AppState> | null> {
  const userProperties = (
    await prisma().userProperty.findMany({
      where: {
        workspaceId,
      },
    })
  ).flatMap((up) => unwrap(toUserPropertyResource(up)));

  switch (channel) {
    case ChannelType.Email: {
      const state = getEmailEditorState({
        emailTemplate: template,
        userProperties,
      });
      return state;
    }
    case ChannelType.Sms:
      throw new Error("Sms not implemented");
      break;
    case ChannelType.MobilePush:
      throw new Error("MobilePush not implemented");
    default:
      assertUnreachable(channel);
  }
}

interface BroadcastTemplateProps {
  templateId: string;
  journeyId: string;
}

export const getServerSideProps: GetServerSideProps<
  PropsWithInitialState<BroadcastTemplateProps>
> = requestContext(async (ctx, dfContext) => {
  const id = ctx.params?.id;

  if (typeof id !== "string" || !validate(id)) {
    return {
      notFound: true,
    };
  }

  const [{ broadcast, messageTemplate, journey }, subscriptionGroups] =
    await Promise.all([
      getOrCreateBroadcast({
        workspaceId: dfContext.workspace.id,
        broadcastId: id,
      }),
      prisma().subscriptionGroup.findMany({
        where: {
          workspaceId: dfContext.workspace.id,
        },
      }),
    ]);

  const channel = getChannel(ctx.query.channel);

  const baseAppState = getBroadcastAppState({ broadcast });
  const channelState = await getChannelState({
    channel,
    template: messageTemplate,
    workspaceId: dfContext.workspace.id,
  });

  const appState: Partial<AppState> = {
    ...baseAppState,
    ...channelState,
    subscriptionGroups: subscriptionGroups.map(subscriptionGroupToResource),
    journeys: {
      type: CompletionStatus.Successful,
      value: [journey],
    },
  };

  return {
    props: addInitialStateToProps({
      serverInitialState: appState,
      props: {
        templateId: messageTemplate.id,
        journeyId: journey.id,
      },
      dfContext,
    }),
  };
});

function getBroadcastMessageNode(
  journeyId: string,
  journeys: AppState["journeys"]
): MessageNode | null {
  if (journeys.type !== CompletionStatus.Successful) {
    return null;
  }
  const journey = journeys.value.find((j) => j.id === journeyId);
  if (!journey) {
    return null;
  }
  let messageNode: MessageNode | null = null;
  for (const node of journey.definition.nodes) {
    if (node.type === JourneyNodeType.MessageNode) {
      messageNode = node;
      break;
    }
  }
  return messageNode;
}

const BroadcastTemplate: NextPage<BroadcastTemplateProps> =
  function BroadcastTemplate({ templateId, journeyId }) {
    const router = useRouter();
    const { id, channel: routeChannel } = router.query;
    const channel = getChannel(routeChannel);
    const { journeys } = useAppStorePick(["journeys"]);
    const messageNode = getBroadcastMessageNode(journeyId, journeys);
    const [subscriptionGroupId, setSubscriptionGroupId] = useState<
      string | null
    >(messageNode?.subscriptionGroupId ?? null);

    const theme = useTheme();

    if (typeof id !== "string") {
      return null;
    }
    let templateEditor;
    switch (channel) {
      case ChannelType.Email:
        templateEditor = (
          <EmailEditor
            hideSaveButton
            hideTitle
            saveOnUpdate
            templateId={templateId}
            sx={{
              height: "100%",
            }}
          />
        );
        break;
      case ChannelType.Sms:
        // FIXME
        throw new Error("Sms not implemented");
        break;
      case ChannelType.MobilePush:
        throw new Error("MobilePush not implemented");
      default:
        assertUnreachable(channel);
    }

    return (
      <BroadcastLayout activeStep="template" id={id}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
          }}
        >
          <Typography fontWeight={400} variant="h2" sx={{ fontSize: 16 }}>
            Broadcast Message Template
          </Typography>
          <Button LinkComponent={Link} href={`/broadcasts/review/${id}`}>
            Next
          </Button>
          <FormControl>
            <InputLabel id="broadcast-channel-label">Channel</InputLabel>
            <Select
              label="Channel"
              labelId="broadcast-channel-label"
              sx={{
                minWidth: theme.spacing(10),
              }}
              onChange={(e) => {
                router.push({
                  query: {
                    id,
                    channel: e.target.value,
                  },
                });
              }}
              value={channel}
            >
              <MenuItem value={ChannelType.Email}>
                {CHANNEL_NAMES[ChannelType.Email]}
              </MenuItem>
              <MenuItem value={ChannelType.Sms}>
                {CHANNEL_NAMES[ChannelType.Sms]}
              </MenuItem>
              <MenuItem disabled value={ChannelType.MobilePush}>
                {CHANNEL_NAMES[ChannelType.MobilePush]}
              </MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ minWidth: "12rem" }}>
            <SubscriptionGroupAutocomplete
              subscriptionGroupId={subscriptionGroupId ?? undefined}
              channel={channel}
              handler={(sg) => {
                setSubscriptionGroupId(sg?.id ?? null);
              }}
            />
          </Box>
        </Stack>
        <Box
          sx={{
            flex: 1,
            width: "100%",
          }}
        >
          {templateEditor}
        </Box>
      </BroadcastLayout>
    );
  };
export default BroadcastTemplate;
