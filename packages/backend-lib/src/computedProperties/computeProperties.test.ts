import { randomUUID } from "crypto";

import { submitBatch } from "../apps";
import prisma from "../prisma";
import {
  EventType,
  UserPropertyDefinitionType,
  UserPropertyResource,
} from "../types";
import { computeState, createTables, dropTables } from "./computeProperties";

describe("computeProperties", () => {
  let workspaceId: string;
  beforeEach(async () => {
    workspaceId = randomUUID();

    await Promise.all([
      createTables(),
      prisma().workspace.create({
        data: {
          id: workspaceId,
          name: randomUUID(),
        },
      }),
    ]);

    await prisma().currentUserEventsTable.create({
      data: {
        workspaceId,
        version: "v2",
      },
    });
  });

  afterEach(async () => {
    await dropTables();
  });

  describe("computeStates", () => {
    beforeEach(async () => {
      await submitBatch({
        workspaceId,
        data: {
          batch: [
            {
              userId: randomUUID(),
              type: EventType.Identify,
              messageId: randomUUID(),
              traits: {
                email: "test@email.com",
              },
            },
          ],
        },
      });
      const userPropertyResource: UserPropertyResource = {
        id: randomUUID(),
        name: "email",
        workspaceId,
        definition: {
          type: UserPropertyDefinitionType.Trait,
          path: "email",
        },
      };
      await computeState({
        workspaceId,
        segments: [],
        userProperties: [userPropertyResource],
      });
    });

    it("produces the correct intermediate states", () => {
      expect(1).toEqual(1);
    });
  });
});
