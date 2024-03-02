import { JourneyNodeType } from "isomorphic-lib/src/types";
import { Edge, Node, XYPosition } from "reactflow";

import { AdditionalJourneyNodeType, JourneyNodeUiProps } from "../../lib/types";
import { layoutNodes } from "./layoutNodes";
import defaultNodeTypeProps from "./nodeTypes/defaultNodeTypeProps";

export const defaultEdges: Edge[] = [
  {
    id: `${AdditionalJourneyNodeType.UiEntryNode}=>${JourneyNodeType.ExitNode}`,
    source: AdditionalJourneyNodeType.UiEntryNode,
    target: JourneyNodeType.ExitNode,
    type: "workflow",
  },
];

export const placeholderNodePosition: XYPosition = { x: 0, y: 0 };

export const defaultNodes = layoutNodes(
  [
    {
      id: AdditionalJourneyNodeType.UiEntryNode,
      data: {
        type: "JourneyNode",
        nodeTypeProps: defaultNodeTypeProps(
          AdditionalJourneyNodeType.UiEntryNode,
          [],
        ),
      },
      position: placeholderNodePosition,
      type: "journey",
    },
    {
      id: JourneyNodeType.ExitNode,
      data: {
        type: "JourneyNode",
        nodeTypeProps: defaultNodeTypeProps(JourneyNodeType.ExitNode, []),
      },
      position: placeholderNodePosition,
      type: "journey",
    },
  ],
  defaultEdges,
);

export function buildNodesIndex(
  nodes: Node<JourneyNodeUiProps>[],
): Record<string, number> {
  return nodes.reduce<Record<string, number>>((memo, node, i) => {
    memo[node.id] = i;
    return memo;
  }, {});
}
