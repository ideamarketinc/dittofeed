import { MessageTemplate, SubscriptionGroup, Workspace } from "@prisma/client";
import { randomUUID } from "crypto";
import { unwrap } from "isomorphic-lib/src/resultHandling/resultUtils";

import { sendEmail } from "./messaging";
import { upsertEmailProvider } from "./messaging/email";
import prisma from "./prisma";
import { upsertSubscriptionSecret } from "./subscriptionGroups";
import {
  ChannelType,
  EmailProviderType,
  EmailTemplateResource,
  InternalEventType,
  MessageTags,
  SubscriptionGroupType,
} from "./types";

async function setupEmailTemplate(workspace: Workspace) {
  const [template, subscriptionGroup] = await Promise.all([
    prisma().messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: `template-${randomUUID()}`,
        definition: {
          type: ChannelType.Email,
          from: "support@company.com",
          subject: "Hello",
          body: "{% unsubscribe_link here %}.",
        } satisfies EmailTemplateResource,
      },
    }),
    prisma().subscriptionGroup.create({
      data: {
        workspaceId: workspace.id,
        name: `group-${randomUUID()}`,
        type: "OptOut",
        channel: ChannelType.Email,
      },
    }),
    upsertEmailProvider({
      workspaceId: workspace.id,
      type: EmailProviderType.Test,
    }),
    upsertSubscriptionSecret({
      workspaceId: workspace.id,
    }),
  ]);
  return { template, subscriptionGroup };
}
describe("messaging", () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await prisma().workspace.create({
      data: {
        name: `workspace-${randomUUID()}`,
      },
    });
  });
  describe("sendEmail", () => {
    describe("when sent from a child workspace", () => {
      it("should use the parent workspace's email provider", async () => {});
    });

    describe.only("when an email to a user with a numeric id includes an unsusbcribe link tag", () => {
      let template: MessageTemplate;
      let subscriptionGroup: SubscriptionGroup;
      beforeEach(async () => {
        ({ template, subscriptionGroup } = await setupEmailTemplate(workspace));
      });
      it("should render the tag", async () => {
        const userId = 1234;
        const email = "test@email.com";

        const payload = await sendEmail({
          workspaceId: workspace.id,
          templateId: template.id,
          messageTags: {
            workspaceId: workspace.id,
            templateId: template.id,
            runId: "run-id-1",
            nodeId: "node-id-1",
            messageId: "message-id-1",
          } satisfies MessageTags,
          userPropertyAssignments: {
            id: userId,
            email,
          },
          userId: String(userId),
          useDraft: false,
          subscriptionGroupDetails: {
            id: subscriptionGroup.id,
            name: subscriptionGroup.name,
            type: SubscriptionGroupType.OptOut,
            action: null,
          },
          providerOverride: EmailProviderType.Test,
        });
        const unwrapped = unwrap(payload);
        if (unwrapped.type === InternalEventType.MessageSkipped) {
          throw new Error("Message should not be skipped");
        }
        expect(unwrapped.type).toBe(InternalEventType.MessageSent);
        expect(unwrapped.variant.to).toBe(email);

        if (unwrapped.variant.type !== ChannelType.Email) {
          throw new Error("Message should be of type Email");
        }
        expect(unwrapped.variant.subject).toBe("Hello");
        expect(unwrapped.variant.from).toBe("support@company.com");
        expect(unwrapped.variant.body).toMatch(/href="([^"]+)"/);
      });
    });
  });
});
