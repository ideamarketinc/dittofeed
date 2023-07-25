import {
  ChannelType,
  CompletionStatus,
  DelayVariantType,
  JourneyDefinition,
  JourneyNodeType,
  JourneyResource,
  SegmentSplitVariantType,
} from "isomorphic-lib/src/types";
import { v4 as uuid } from "uuid";

import { JourneyState } from "../../lib/types";
import { journeyDefinitionFromState, journeyToState } from "./store";

describe("journeyToState", () => {
  let journeyResource: JourneyResource;
  let journeyId: string;
  let workspaceId: string;

  describe("when journey has nested wait for's", () => {
    beforeEach(() => {
      const definition: JourneyDefinition = {
        nodes: [
          {
            id: "c0794f62-24a8-4c64-acc1-d7866904b5bb",
            type: JourneyNodeType.WaitForNode,
            timeoutChild: "9503fc2f-eb34-4e25-893b-89221b98ba50",
            timeoutSeconds: 604800,
            segmentChildren: [
              {
                id: "ExitNode",
                segmentId: "d40d5b69-7c16-4cba-8578-6268936d0ca4",
              },
            ],
          },
          {
            id: "9503fc2f-eb34-4e25-893b-89221b98ba50",
            name: "Code Deployment Reminder 1a",
            type: JourneyNodeType.MessageNode,
            child: "b6cffc04-7180-45af-8e7e-83c137bb4d2b",
            variant: {
              type: ChannelType.Email,
              templateId: "4bad6541-aabf-46ce-a51e-0702773b8397",
            },
            subscriptionGroupId: "05e11d83-0b16-4ac3-9c86-b53a25967781",
          },
          {
            id: "b6cffc04-7180-45af-8e7e-83c137bb4d2b",
            type: JourneyNodeType.WaitForNode,
            timeoutChild: "ExitNode",
            timeoutSeconds: 604800,
            segmentChildren: [
              {
                id: "d8baec24-6d5b-4b93-811c-f61cc220cf92",
                segmentId: "d40d5b69-7c16-4cba-8578-6268936d0ca4",
              },
            ],
          },
          {
            id: "d8baec24-6d5b-4b93-811c-f61cc220cf92",
            type: JourneyNodeType.WaitForNode,
            timeoutChild: "0612abc1-dc54-407f-a603-01d396ddfdb2",
            timeoutSeconds: 604800,
            segmentChildren: [
              {
                id: "80d43a6a-3ebc-4296-8ddd-abcdf92df174",
                segmentId: "146ce2e1-fdbc-4bc6-98ea-51ec38728cb2",
              },
            ],
          },
          {
            id: "0612abc1-dc54-407f-a603-01d396ddfdb2",
            type: JourneyNodeType.SegmentSplitNode,
            variant: {
              type: SegmentSplitVariantType.Boolean,
              segment: "84daa056-f768-4f5a-aad3-5afe1567df18",
              trueChild: "ed8fa768-af64-4338-aa31-44824420c065",
              falseChild: "0dbab64c-c451-44d3-af28-33678cc86895",
            },
          },
          {
            id: "0dbab64c-c451-44d3-af28-33678cc86895",
            name: "Message 3",
            type: JourneyNodeType.MessageNode,
            child: "80d43a6a-3ebc-4296-8ddd-abcdf92df174",
            variant: {
              type: ChannelType.Email,
              templateId: "9227c35b-2a05-4c04-a703-ddec48006b01",
            },
            subscriptionGroupId: "05e11d83-0b16-4ac3-9c86-b53a25967781",
          },
          {
            id: "80d43a6a-3ebc-4296-8ddd-abcdf92df174",
            type: JourneyNodeType.WaitForNode,
            timeoutChild: "ExitNode",
            timeoutSeconds: 604800,
            segmentChildren: [
              {
                id: "ExitNode",
                segmentId: "146ce2e1-fdbc-4bc6-98ea-51ec38728cb2",
              },
            ],
          },
          {
            id: "ed8fa768-af64-4338-aa31-44824420c065",
            name: "Message 2",
            type: JourneyNodeType.MessageNode,
            child: "80d43a6a-3ebc-4296-8ddd-abcdf92df174",
            variant: {
              type: ChannelType.Email,
              templateId: "2dc8bf8b-92db-4e37-8c0d-47031647d99c",
            },
            subscriptionGroupId: "05e11d83-0b16-4ac3-9c86-b53a25967781",
          },
        ],
        exitNode: {
          type: JourneyNodeType.ExitNode,
        },
        entryNode: {
          type: JourneyNodeType.EntryNode,
          child: "c0794f62-24a8-4c64-acc1-d7866904b5bb",
          segment: "d033db9c-4572-4f6c-bb7a-182598b1dde8",
        },
      };
    });
  });
  describe("when journey has split then delay", () => {
    beforeEach(() => {
      journeyId = uuid();
      workspaceId = uuid();

      journeyResource = {
        id: journeyId,
        name: "My Journey",
        status: "NotStarted",
        definition: {
          entryNode: {
            type: JourneyNodeType.EntryNode,
            segment: uuid(),
            child: "908b9795-60b7-4333-a57c-a30f4972fb6b",
          },
          exitNode: {
            type: JourneyNodeType.ExitNode,
          },
          nodes: [
            {
              id: "908b9795-60b7-4333-a57c-a30f4972fb6b",
              type: JourneyNodeType.MessageNode,
              child: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
              variant: {
                type: ChannelType.Email,
                templateId: uuid(),
              },
            },
            {
              id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
              type: JourneyNodeType.DelayNode,
              child: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
              variant: {
                type: DelayVariantType.Second,
                seconds: 1800,
              },
            },
            {
              id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
              type: JourneyNodeType.SegmentSplitNode,
              variant: {
                type: SegmentSplitVariantType.Boolean,
                segment: uuid(),
                trueChild: "6ce89301-2a35-4562-b1db-54689bfe0e05",
                falseChild: "ExitNode",
              },
            },
            {
              id: "6ce89301-2a35-4562-b1db-54689bfe0e05",
              type: JourneyNodeType.MessageNode,
              child: JourneyNodeType.ExitNode,
              variant: {
                type: ChannelType.Email,
                templateId: uuid(),
              },
            },
          ],
        },
        workspaceId,
      };
    });

    it("produces the correct ui state", () => {
      const uiState = journeyToState(journeyResource);
      expect(uiState).toEqual({
        journeyNodes: expect.arrayContaining([
          {
            id: "EntryNode",
            position: { x: 400, y: 100 },
            type: "journey",
            data: {
              type: "JourneyNode",
              nodeTypeProps: {
                type: "EntryNode",
                segmentId: journeyResource.definition.entryNode.segment,
              },
            },
          },
          {
            id: "908b9795-60b7-4333-a57c-a30f4972fb6b",
            position: { x: 400, y: 300 },
            type: "journey",
            data: {
              type: "JourneyNode",
              nodeTypeProps: {
                type: "MessageNode",
                templateId: journeyResource.definition.nodes.flatMap((n) =>
                  n.type === JourneyNodeType.MessageNode &&
                  n.id === "908b9795-60b7-4333-a57c-a30f4972fb6b"
                    ? n
                    : []
                )[0]?.variant.templateId,
                name: "Message - 908b9795-60b7-4333-a57c-a30f4972fb6b",
              },
            },
          },
          {
            id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
            position: { x: 400, y: 500 },
            type: "journey",
            data: {
              type: "JourneyNode",
              nodeTypeProps: { type: "DelayNode", seconds: 1800 },
            },
          },
          {
            id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
            position: { x: 400, y: 700 },
            type: "journey",
            data: {
              type: "JourneyNode",
              nodeTypeProps: {
                type: "SegmentSplitNode",
                name: "True / False Branch",
                segmentId: journeyResource.definition.nodes.flatMap((n) =>
                  n.type === JourneyNodeType.SegmentSplitNode &&
                  n.id === "9d5367b0-882e-49c2-a6d2-4c28e5416d04"
                    ? n
                    : []
                )[0]?.variant.segment,
                trueLabelNodeId: expect.any(String),
                falseLabelNodeId: expect.any(String),
              },
            },
          },
          {
            id: expect.any(String),
            position: { x: 200, y: 900 },
            type: "label",
            data: { type: "LabelNode", title: "true" },
          },
          {
            id: expect.any(String),
            position: { x: 600, y: 900 },
            type: "label",
            data: { type: "LabelNode", title: "false" },
          },
          {
            id: "6ce89301-2a35-4562-b1db-54689bfe0e05",
            position: { x: 200, y: 1100 },
            type: "journey",
            data: {
              type: "JourneyNode",
              nodeTypeProps: {
                type: "MessageNode",
                templateId: journeyResource.definition.nodes.flatMap((n) =>
                  n.type === JourneyNodeType.MessageNode &&
                  n.id === "6ce89301-2a35-4562-b1db-54689bfe0e05"
                    ? n
                    : []
                )[0]?.variant.templateId,
                name: "Message - 6ce89301-2a35-4562-b1db-54689bfe0e05",
              },
            },
          },
          {
            id: expect.any(String),
            position: { x: 400, y: 1300 },
            type: "empty",
            data: { type: "EmptyNode" },
          },
          {
            id: "ExitNode",
            position: { x: 400, y: 1500 },
            type: "journey",
            data: { type: "JourneyNode", nodeTypeProps: { type: "ExitNode" } },
          },
        ]),
        journeyNodesIndex: expect.objectContaining({
          EntryNode: 0,
          "908b9795-60b7-4333-a57c-a30f4972fb6b": 1,
          "6940ebec-a2ca-47dc-a356-42dc0245dd2e": 2,
          "9d5367b0-882e-49c2-a6d2-4c28e5416d04": 3,
          "6ce89301-2a35-4562-b1db-54689bfe0e05": 5,
          ExitNode: 7,
        }),
        journeyEdges: [
          {
            id: "EntryNode=>908b9795-60b7-4333-a57c-a30f4972fb6b",
            source: "EntryNode",
            target: "908b9795-60b7-4333-a57c-a30f4972fb6b",
            type: "workflow",
          },
          {
            id: "908b9795-60b7-4333-a57c-a30f4972fb6b=>6940ebec-a2ca-47dc-a356-42dc0245dd2e",
            source: "908b9795-60b7-4333-a57c-a30f4972fb6b",
            target: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
            type: "workflow",
          },
          {
            id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e=>9d5367b0-882e-49c2-a6d2-4c28e5416d04",
            source: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
            target: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
            type: "workflow",
          },
          {
            id: expect.any(String),
            source: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
            target: expect.any(String),
            type: "placeholder",
          },
          {
            id: expect.any(String),
            source: expect.any(String),
            target: "6ce89301-2a35-4562-b1db-54689bfe0e05",
            type: "workflow",
          },
          {
            id: expect.any(String),
            source: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
            target: expect.any(String),
            type: "placeholder",
          },
          {
            id: expect.any(String),
            source: expect.any(String),
            target: expect.any(String),
            type: "workflow",
          },
          {
            id: expect.any(String),
            source: expect.any(String),
            target: expect.any(String),
            type: "workflow",
          },
          {
            id: expect.any(String),
            source: expect.any(String),
            target: "ExitNode",
            type: "workflow",
          },
        ],
        journeyName: "My Journey",
      });
    });
  });

  describe("when a journey has a split, and a nested split", () => {
    beforeEach(() => {
      journeyId = uuid();
      workspaceId = uuid();

      journeyResource = {
        id: journeyId,
        name: "My Journey",
        status: "NotStarted",
        definition: {
          entryNode: {
            type: JourneyNodeType.EntryNode,
            segment: uuid(),
            child: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          },
          exitNode: {
            type: JourneyNodeType.ExitNode,
          },
          nodes: [
            {
              id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
              type: JourneyNodeType.SegmentSplitNode,
              variant: {
                type: SegmentSplitVariantType.Boolean,
                segment: uuid(),
                trueChild: "6ce89301-2a35-4562-b1db-54689bfe0e05",
                falseChild: "ExitNode",
              },
            },
            {
              id: "6ce89301-2a35-4562-b1db-54689bfe0e05",
              type: JourneyNodeType.SegmentSplitNode,
              variant: {
                type: SegmentSplitVariantType.Boolean,
                segment: uuid(),
                trueChild: "ExitNode",
                falseChild: "ExitNode",
              },
            },
          ],
        },
        workspaceId,
      };
    });

    it("produces the correct ui state", () => {
      const uiState = journeyToState(journeyResource);

      expect(
        uiState.journeyNodes.filter((n) => n.type === "label")
      ).toHaveLength(4);

      expect(
        uiState.journeyNodes.filter((n) => n.type === "empty")
      ).toHaveLength(2);
    });
  });
});

describe("journeyDefinitionFromState", () => {
  let state: JourneyState;

  beforeEach(() => {
    state = {
      journeySelectedNodeId: null,
      journeyUpdateRequest: {
        type: CompletionStatus.NotStarted,
      },
      journeyNodes: [
        {
          id: JourneyNodeType.EntryNode,
          data: {
            type: "JourneyNode",
            nodeTypeProps: {
              type: JourneyNodeType.EntryNode,
              segmentId: uuid(),
            },
          },
          position: { x: 400, y: 100 },
          type: "journey",
          width: 300,
          height: 90,
          selected: false,
        },
        {
          id: "908b9795-60b7-4333-a57c-a30f4972fb6b",
          data: {
            type: "JourneyNode",
            nodeTypeProps: {
              type: JourneyNodeType.MessageNode,
              name: "Message 1",
              channel: ChannelType.Email,
              templateId: uuid(),
            },
          },
          position: { x: 400, y: 300 },
          type: "journey",
          width: 300,
          height: 90,
        },
        {
          id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          data: {
            type: "JourneyNode",
            nodeTypeProps: { type: JourneyNodeType.DelayNode, seconds: 1800 },
          },
          position: { x: 400, y: 500 },
          type: "journey",
          width: 300,
          height: 82,
          selected: false,
        },
        {
          id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          data: {
            type: "JourneyNode",
            nodeTypeProps: {
              type: JourneyNodeType.SegmentSplitNode,
              segmentId: uuid(),
              name: "True / False Branch",
              trueLabelNodeId: "c1191029-49bd-4947-8ff9-9a43b64261e9",
              falseLabelNodeId: "70c82013-c7a5-4b55-93ba-4158c500b79d",
            },
          },
          position: { x: 400, y: 700 },
          type: "journey",
          width: 300,
          height: 90,
        },
        {
          id: "c1191029-49bd-4947-8ff9-9a43b64261e9",
          data: { type: "LabelNode", title: "true" },
          position: { x: 200, y: 900 },
          type: "label",
          width: 44,
          height: 38,
        },
        {
          id: "6ce89301-2a35-4562-b1db-54689bfe0e05",
          data: {
            type: "JourneyNode",
            nodeTypeProps: {
              type: JourneyNodeType.MessageNode,
              channel: ChannelType.Email,
              name: "Message 2",
              templateId: uuid(),
            },
          },
          position: { x: 200, y: 1100 },
          type: "journey",
          width: 300,
          height: 90,
        },
        {
          id: "0492df84-8c15-419a-9d8d-8856ae2a4e73",
          data: { type: "EmptyNode" },
          position: { x: 400, y: 1300 },
          type: "empty",
          width: 8,
          height: 8,
        },
        {
          id: JourneyNodeType.ExitNode,
          data: {
            type: "JourneyNode",
            nodeTypeProps: { type: JourneyNodeType.ExitNode },
          },
          position: { x: 400, y: 1500 },
          type: "journey",
          width: 300,
          height: 60,
        },
        {
          id: "70c82013-c7a5-4b55-93ba-4158c500b79d",
          data: { type: "LabelNode", title: "false" },
          position: { x: 600, y: 900 },
          type: "label",
          width: 49,
          height: 38,
        },
      ],
      journeyEdges: [
        {
          id: "908b9795-60b7-4333-a57c-a30f4972fb6b->6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          source: "908b9795-60b7-4333-a57c-a30f4972fb6b",
          target: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          type: "workflow",
        },
        {
          id: "EntryNode->908b9795-60b7-4333-a57c-a30f4972fb6b",
          source: "EntryNode",
          target: "908b9795-60b7-4333-a57c-a30f4972fb6b",
          type: "workflow",
        },
        {
          id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e->9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          source: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          target: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          type: "workflow",
        },
        {
          id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04->c1191029-49bd-4947-8ff9-9a43b64261e9",
          source: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          target: "c1191029-49bd-4947-8ff9-9a43b64261e9",
          type: "placeholder",
        },
        {
          id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04->70c82013-c7a5-4b55-93ba-4158c500b79d",
          source: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          target: "70c82013-c7a5-4b55-93ba-4158c500b79d",
          type: "placeholder",
        },
        {
          id: "70c82013-c7a5-4b55-93ba-4158c500b79d->0492df84-8c15-419a-9d8d-8856ae2a4e73",
          source: "70c82013-c7a5-4b55-93ba-4158c500b79d",
          target: "0492df84-8c15-419a-9d8d-8856ae2a4e73",
          data: { type: "WorkflowEdge", disableMarker: true },
          type: "workflow",
        },
        {
          id: "0492df84-8c15-419a-9d8d-8856ae2a4e73->ExitNode",
          source: "0492df84-8c15-419a-9d8d-8856ae2a4e73",
          target: "ExitNode",
          type: "workflow",
        },
        {
          id: "6ce89301-2a35-4562-b1db-54689bfe0e05->0492df84-8c15-419a-9d8d-8856ae2a4e73",
          source: "6ce89301-2a35-4562-b1db-54689bfe0e05",
          target: "0492df84-8c15-419a-9d8d-8856ae2a4e73",
          type: "workflow",
        },
        {
          id: "c1191029-49bd-4947-8ff9-9a43b64261e9->6ce89301-2a35-4562-b1db-54689bfe0e05",
          source: "c1191029-49bd-4947-8ff9-9a43b64261e9",
          target: "6ce89301-2a35-4562-b1db-54689bfe0e05",
          type: "workflow",
        },
      ],
      journeyNodesIndex: {
        EntryNode: 0,
        "908b9795-60b7-4333-a57c-a30f4972fb6b": 1,
        "6940ebec-a2ca-47dc-a356-42dc0245dd2e": 2,
        "9d5367b0-882e-49c2-a6d2-4c28e5416d04": 3,
        "c1191029-49bd-4947-8ff9-9a43b64261e9": 4,
        "6ce89301-2a35-4562-b1db-54689bfe0e05": 5,
        "0492df84-8c15-419a-9d8d-8856ae2a4e73": 6,
        ExitNode: 7,
        "70c82013-c7a5-4b55-93ba-4158c500b79d": 8,
      },
      journeyDraggedComponentType: null,
      journeyName: "My Journey",
    };
  });

  it("returns a journey definition", () => {
    const result = journeyDefinitionFromState({
      state,
    });
    if (result.isErr()) {
      throw new Error(
        `journeyResourceFromState failed with ${result.error.message}`
      );
    }
    expect(result.value).toEqual({
      entryNode: {
        type: JourneyNodeType.EntryNode,
        segment: expect.any(String),
        child: "908b9795-60b7-4333-a57c-a30f4972fb6b",
      },
      exitNode: {
        type: JourneyNodeType.ExitNode,
      },
      nodes: [
        {
          id: "908b9795-60b7-4333-a57c-a30f4972fb6b",
          type: JourneyNodeType.MessageNode,
          child: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          name: "Message 1",
          variant: {
            type: ChannelType.Email,
            templateId: expect.any(String),
          },
        },
        {
          id: "6940ebec-a2ca-47dc-a356-42dc0245dd2e",
          type: JourneyNodeType.DelayNode,
          child: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          variant: {
            type: "Second",
            seconds: 1800,
          },
        },
        {
          id: "9d5367b0-882e-49c2-a6d2-4c28e5416d04",
          type: JourneyNodeType.SegmentSplitNode,
          variant: {
            type: SegmentSplitVariantType.Boolean,
            segment: expect.any(String),
            trueChild: "6ce89301-2a35-4562-b1db-54689bfe0e05",
            falseChild: "ExitNode",
          },
        },
        {
          id: "6ce89301-2a35-4562-b1db-54689bfe0e05",
          type: JourneyNodeType.MessageNode,
          name: "Message 2",
          child: JourneyNodeType.ExitNode,
          variant: {
            type: ChannelType.Email,
            templateId: expect.any(String),
          },
        },
      ],
    });
  });
});
