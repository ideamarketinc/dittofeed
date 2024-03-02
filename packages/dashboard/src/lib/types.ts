import { Config } from "backend-lib/src/config";
import { Draft } from "immer";
import {
  BroadcastResource,
  ChannelType,
  DataSourceConfigurationResource,
  DefaultEmailProviderResource,
  DefaultSmsProviderResource,
  DelayVariantType,
  DFRequestContext,
  EntryNode,
  EphemeralRequestStatus,
  EventEntryNode,
  ExitNode,
  FeatureMap,
  IntegrationResource,
  JourneyNodeType,
  JourneyResource,
  JourneyStats,
  JourneyStatsResponse,
  LocalTimeDelayVariant,
  MessageTemplateResource,
  PartialExceptType,
  PersistedEmailProvider,
  PersistedSmsProvider,
  RequestStatus,
  SavedSubscriptionGroupResource,
  SecondsDelayVariant,
  SecretAvailabilityResource,
  SecretResource,
  SegmentEntryNode,
  SegmentNode,
  SegmentNodeType,
  SegmentResource,
  SourceControlProviderEnum,
  SubscriptionGroupResource,
  UserPropertyDefinition,
  UserPropertyResource,
  WaitForNode,
  WorkspaceMemberResource,
  WorkspaceMemberRoleResource,
  WorkspaceResource,
  WriteKeyResource,
} from "isomorphic-lib/src/types";
import {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  PreviewData,
} from "next";
import { ParsedUrlQuery } from "querystring";
import { Edge, EdgeChange, Node, NodeChange } from "reactflow";
import { Optional } from "utility-types";

export type PropsWithInitialState<T = object> = {
  serverInitialState: PreloadedState;
} & T;

export type PreloadedState = Partial<AppState>;

export type AppContents = AppState & AppActions;

export type GetDFServerSideProps<
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style, @typescript-eslint/no-explicit-any
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData,
> = (
  context: GetServerSidePropsContext<Q, D>,
  dfContext: DFRequestContext,
) => Promise<GetServerSidePropsResult<P>>;

export type UserPropertyMessages = Record<
  string,
  Record<
    string,
    {
      name: string;
      type: ChannelType;
    }
  >
>;

// README: properties get shallowly overridden when merging serverside state
// into the default client state, see lib/appStore.ts initializeStore. For that
// reason properties should not be nested in AppState.
export type AppState = {
  apiBase: string;
  dashboardUrl: string;
  features: FeatureMap;
  workspace: RequestStatus<WorkspaceResource, Error>;
  member: WorkspaceMemberResource | null;
  memberRoles: WorkspaceMemberRoleResource[];
  drawerOpen: boolean;
  segments: RequestStatus<SegmentResource[], Error>;
  broadcasts: BroadcastResource[];
  subscriptionGroups: SavedSubscriptionGroupResource[];
  userProperties: RequestStatus<UserPropertyResource[], Error>;
  messages: RequestStatus<MessageTemplateResource[], Error>;
  userPropertyMessages: UserPropertyMessages;
  journeys: RequestStatus<JourneyResource[], Error>;
  traits: string[];
  getTraitsRequest: EphemeralRequestStatus<Error>;
  writeKeys: WriteKeyResource[];
  secrets: SecretResource[];
  secretAvailability: SecretAvailabilityResource[];
  defaultEmailProvider: DefaultEmailProviderResource | null;
  emailProviders: PersistedEmailProvider[];
  defaultSmsProvider: DefaultSmsProviderResource | null;
  smsProviders: PersistedSmsProvider[];
  dataSourceConfigurations: RequestStatus<
    DataSourceConfigurationResource[],
    Error
  >;
  integrations: IntegrationResource[];
  sourceControlProvider?: SourceControlProviderEnum;
} & PageStoreContents &
  Pick<
    Config,
    | "trackDashboard"
    | "dashboardWriteKey"
    | "enableSourceControl"
    | "sourceControlProvider"
    | "enableMobilePush"
  > &
  Partial<Pick<Config, "signoutUrl">>;

export interface AppActions {
  toggleDrawer: () => void;
  upsertEmailProvider: (emailProvider: PersistedEmailProvider) => void;
  upsertSmsProvider: (response: PersistedSmsProvider) => void;
  upsertDataSourceConfiguration: (
    dataSource: DataSourceConfigurationResource,
  ) => void;
  upsertMessage: (message: MessageTemplateResource) => void;
  upsertBroadcast: (message: BroadcastResource) => void;
  deleteMessage: (id: string) => void;
  upsertSegment: (segment: SegmentResource) => void;
  deleteSegment: (segmentId: string) => void;
  upsertJourney: (journey: JourneyResource) => void;
  deleteJourney: (segmentId: string) => void;
  upsertSecrets: (secrets: SecretResource[]) => void;
  deleteSecret: (secretName: string) => void;
  upsertSubscriptionGroup: (
    subscriptionGroup: SavedSubscriptionGroupResource,
  ) => void;
  deleteSubscriptionGroup: (id: string) => void;
  upsertUserProperty: (userProperty: UserPropertyResource) => void;
  deleteUserProperty: (userPropertyId: string) => void;
  upsertIntegration: (integrations: IntegrationResource) => void;
  upsertTraits: (traits: string[]) => void;
  setGetTraitsRequest: (request: EphemeralRequestStatus<Error>) => void;
  setDefaultEmailProvider: (
    defaultEmailProvider: DefaultEmailProviderResource,
  ) => void;
  setDefaultSmsProvider: (
    defaultSmsProvider: DefaultSmsProviderResource,
  ) => void;
}

export interface SegmentIndexContent {
  segmentDeleteRequest: EphemeralRequestStatus<Error>;
  setSegmentDeleteRequest: (request: EphemeralRequestStatus<Error>) => void;
  segmentDownloadRequest: EphemeralRequestStatus<Error>;
  setSegmentDownloadRequest: (request: EphemeralRequestStatus<Error>) => void;
}

export interface UserPropertyIndexContent {
  userPropertyDeleteRequest: EphemeralRequestStatus<Error>;
  setUserPropertyDeleteRequest: (
    request: EphemeralRequestStatus<Error>,
  ) => void;
}

export interface UserPropertyEditorContent {
  editedUserProperty: UserPropertyResource | null;
  updateUserPropertyDefinition: (
    updater: (
      currentValue: Draft<UserPropertyDefinition>,
    ) => Draft<UserPropertyDefinition>,
  ) => void;
  userPropertyUpdateRequest: EphemeralRequestStatus<Error>;
  setUserPropertyUpdateRequest: (
    request: EphemeralRequestStatus<Error>,
  ) => void;
  updateEditedUserProperty: (
    userProperty: Partial<Omit<UserPropertyResource, "id" | "workspaceId">>,
  ) => void;
}

export interface JourneyIndexContent {
  journeyDeleteRequest: EphemeralRequestStatus<Error>;
  setJourneyDeleteRequest: (request: EphemeralRequestStatus<Error>) => void;
}

export interface UserIndexContent {
  userDeleteRequest: EphemeralRequestStatus<Error>;
  setUserDeleteRequest: (request: EphemeralRequestStatus<Error>) => void;
}

export interface MessageTemplateIndexContent {
  messageTemplateDeleteRequest: EphemeralRequestStatus<Error>;
  setMessageTemplateDeleteRequest: (
    request: EphemeralRequestStatus<Error>,
  ) => void;
}

export type EditedBroadcast = Optional<
  BroadcastResource,
  "segmentId" | "triggeredAt" | "createdAt"
>;

export interface BroadcastEditorContents {
  editedBroadcast: EditedBroadcast | null;
  broadcastUpdateRequest: EphemeralRequestStatus<Error>;
  broadcastTriggerRequest: EphemeralRequestStatus<Error>;
  setBroadcastUpdateRequest: (request: EphemeralRequestStatus<Error>) => void;
  setBroadcastTriggerRequest: (request: EphemeralRequestStatus<Error>) => void;
  updateEditedBroadcast: (broadcast: Partial<BroadcastResource>) => void;
}

export interface SubscriptionGroupEditorContents {
  editedSubscriptionGroup: SubscriptionGroupResource | null;
  subscriptionGroupUpdateRequest: EphemeralRequestStatus<Error>;
  subscriptionGroupDeleteRequest: EphemeralRequestStatus<Error>;
  setSubscriptionGroupUpdateRequest: (
    request: EphemeralRequestStatus<Error>,
  ) => void;
  setSubscriptionGroupDeleteRequest: (
    request: EphemeralRequestStatus<Error>,
  ) => void;
  updateEditedSubscriptionGroup: (
    broadcast: Partial<SubscriptionGroupResource>,
  ) => void;
}

export interface SegmentEditorState {
  editedSegment: SegmentResource | null;
  segmentUpdateRequest: EphemeralRequestStatus<Error>;
}

export interface SegmentEditorContents extends SegmentEditorState {
  setEditableSegmentName: (name: string) => void;
  addEditableSegmentChild: (parentId: string) => void;
  removeEditableSegmentChild: (parentId: string, nodeId: string) => void;
  updateEditableSegmentNodeType: (
    nodeId: string,
    nodeType: SegmentNodeType,
  ) => void;
  updateEditableSegmentNodeData: (
    nodeId: string,
    updater: (currentValue: Draft<SegmentNode>) => void,
  ) => void;
  setSegmentUpdateRequest: (request: EphemeralRequestStatus<Error>) => void;
}

export interface JourneyState {
  journeyName: string;
  journeyDraggedComponentType: JourneyUiNodeTypeProps["type"] | null;
  journeySelectedNodeId: string | null;
  journeyNodes: Node<JourneyNodeUiProps>[];
  journeyNodesIndex: Record<string, number>;
  journeyEdges: Edge<JourneyUiEdgeData>[];
  journeyUpdateRequest: EphemeralRequestStatus<Error>;
  journeyStats: Record<string, JourneyStats>;
  journeyStatsRequest: EphemeralRequestStatus<Error>;
}

export interface AddNodesParams {
  source: string;
  target: string;
  nodes: Node<JourneyNodeUiProps>[];
  edges: Edge[];
}

export interface JourneyContent extends JourneyState {
  setDraggedComponentType: (t: JourneyUiNodeTypeProps["type"] | null) => void;
  setSelectedNodeId: (t: string | null) => void;
  addNodes: (params: AddNodesParams) => void;
  setEdges: (changes: EdgeChange[]) => void;
  setNodes: (changes: NodeChange[]) => void;
  deleteJourneyNode: (nodeId: string) => void;
  updateJourneyNodeData: (
    nodeId: string,
    updater: (currentValue: Draft<Node<JourneyUiNodeDefinitionProps>>) => void,
  ) => void;
  setJourneyUpdateRequest: (request: EphemeralRequestStatus<Error>) => void;
  setJourneyName: (name: string) => void;
  updateLabelNode: (nodeId: string, title: string) => void;
  setJourneyStatsRequest: (request: EphemeralRequestStatus<Error>) => void;
  upsertJourneyStats: (stats: JourneyStatsResponse) => void;
}

export type PageStoreContents = SegmentEditorContents &
  SegmentIndexContent &
  UserPropertyIndexContent &
  JourneyIndexContent &
  UserIndexContent &
  MessageTemplateIndexContent &
  UserPropertyEditorContent &
  JourneyContent &
  BroadcastEditorContents &
  SubscriptionGroupEditorContents;

export enum AdditionalJourneyNodeType {
  EntryUiNode = "EntryUiNode",
}

export type EntryUiNodeVariant =
  | PartialExceptType<SegmentEntryNode, JourneyNodeType.SegmentEntryNode>
  | PartialExceptType<EventEntryNode, JourneyNodeType.EventEntryNode>;

export interface EntryUiNodeProps {
  type: AdditionalJourneyNodeType.EntryUiNode;
  variant: EntryUiNodeVariant;
}

export interface ExitUiNodeProps {
  type: JourneyNodeType.ExitNode;
}

export interface MessageUiNodeProps {
  type: JourneyNodeType.MessageNode;
  name: string;
  templateId?: string;
  channel: ChannelType;
  subscriptionGroupId?: string;
}

export type DelayUiNodeVariant =
  | PartialExceptType<LocalTimeDelayVariant, DelayVariantType.LocalTime>
  | PartialExceptType<SecondsDelayVariant, DelayVariantType.Second>;

export interface DelayUiNodeProps {
  type: JourneyNodeType.DelayNode;
  variant: DelayUiNodeVariant;
}

export interface SegmentSplitUiNodeProps {
  type: JourneyNodeType.SegmentSplitNode;
  name: string;
  segmentId?: string;
  trueLabelNodeId: string;
  falseLabelNodeId: string;
}

export interface WaitForUiNodeProps {
  type: JourneyNodeType.WaitForNode;
  timeoutSeconds?: number;
  timeoutLabelNodeId: string;
  segmentChildren: {
    labelNodeId: string;
    segmentId?: string;
  }[];
}

export type JourneyUiNodeTypeProps =
  | EntryUiNodeProps
  | ExitUiNodeProps
  | MessageUiNodeProps
  | DelayUiNodeProps
  | SegmentSplitUiNodeProps
  | WaitForUiNodeProps;

export type JourneyUiNodePairing =
  | [EntryUiNodeProps, EntryNode]
  | [ExitUiNodeProps, ExitNode]
  | [MessageUiNodeProps, SegmentNode]
  | [DelayUiNodeProps, SegmentNode]
  | [SegmentSplitUiNodeProps, SegmentNode]
  | [WaitForUiNodeProps, WaitForNode];

export enum JourneyUiNodeType {
  JourneyUiNodeDefinitionProps = "JourneyUiNodeDefinitionProps",
  JourneyUiNodeEmptyProps = "JourneyUiNodeEmptyProps",
  JourneyUiNodeLabelProps = "JourneyUiNodeLabelProps",
}

export interface JourneyUiNodeDefinitionProps {
  type: JourneyUiNodeType.JourneyUiNodeDefinitionProps;
  nodeTypeProps: JourneyUiNodeTypeProps;
}

export interface JourneyUiNodeEmptyProps {
  type: JourneyUiNodeType.JourneyUiNodeEmptyProps;
}

export interface JourneyUiNodeLabelProps {
  type: JourneyUiNodeType.JourneyUiNodeLabelProps;
  title: string;
}

export type JourneyUiNodePresentationalProps =
  | JourneyUiNodeLabelProps
  | JourneyUiNodeEmptyProps;

export type JourneyNodeUiProps =
  | JourneyUiNodeDefinitionProps
  | JourneyUiNodePresentationalProps;

export type TimeUnit = "seconds" | "minutes" | "hours" | "days" | "weeks";

export enum JourneyUiEdgeType {
  JourneyUiDefinitionEdgeProps = "JourneyUiDefinitionEdgeProps",
  JourneyUiPlaceholderEdgeProps = "JourneyUiPlaceholderEdgeProps",
}

export interface JourneyUiDefinitionEdgeProps {
  type: JourneyUiEdgeType.JourneyUiDefinitionEdgeProps;
  disableMarker?: boolean;
}

export interface JourneyUiPlaceholderEdgeProps {
  type: JourneyUiEdgeType.JourneyUiPlaceholderEdgeProps;
}

export type JourneyUiEdgeData =
  | JourneyUiDefinitionEdgeProps
  | JourneyUiPlaceholderEdgeProps;

export interface GroupedOption<T> {
  id: T;
  group: string;
  label: string;
  disabled?: boolean;
}

export interface EventResources {
  name: string;
  link: string;
  key: string;
}
