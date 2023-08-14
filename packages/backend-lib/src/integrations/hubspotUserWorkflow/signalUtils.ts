import { ComputedPropertyAssignment } from "isomorphic-lib/src/types";

import connectWorkflowClient from "../../temporal/connectWorkflowClient";
import {
  generateHubspotUserWorkflowId,
  hubspotUserComputedProperties,
  hubspotUserWorkflow,
} from "../hubspotUserWorkflow";

export async function startHubspotUserIntegrationWorkflow({
  workspaceId,
  userId,
  computedPropertyAssignment,
}: {
  workspaceId: string;
  userId: string;
  computedPropertyAssignment: ComputedPropertyAssignment;
}) {
  const workflowClient = await connectWorkflowClient();

  await workflowClient.signalWithStart<
    typeof hubspotUserWorkflow,
    [ComputedPropertyAssignment]
  >(hubspotUserWorkflow, {
    taskQueue: "default",
    workflowId: generateHubspotUserWorkflowId({ workspaceId, userId }),
    args: [{ workspaceId, userId }],
    signal: hubspotUserComputedProperties,
    signalArgs: [computedPropertyAssignment],
  });
}
