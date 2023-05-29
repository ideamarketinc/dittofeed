import { createDecoder } from "fast-jwt";
import { schemaValidate } from "isomorphic-lib/src/resultHandling/schemaValidation";

import prisma from "./prisma";
import { DecodedJwt } from "./types";

const decoder = createDecoder();

export function decodeJwtHeader(header: string): DecodedJwt | null {
  const bearerToken = header.replace("Bearer ", "");
  const decoded: unknown | null = bearerToken ? decoder(bearerToken) : null;

  if (!decoded) {
    return null;
  }
  const result = schemaValidate(decoded, DecodedJwt);
  if (result.isErr()) {
    return null;
  }
  return result.value;
}

/**
 *
 * @param writeKey Authorization header of the form "basic <encodedWriteKey>".
 * The write key is encoded in base64, taking the form base64(secretKeyId:secretKeyValue).
 * @returns a boolean indicating whether the write key is valid.
 */
export async function validateWriteKey({
  writeKey,
}: {
  writeKey: string;
}): Promise<boolean> {
  // Extract the encodedWriteKey from the header
  const encodedWriteKey = writeKey.split(" ")[1];
  if (!encodedWriteKey) {
    return false;
  }

  // Decode the writeKey
  const decodedWriteKey = Buffer.from(encodedWriteKey, "base64").toString(
    "utf-8"
  );

  // Split the writeKey into secretKeyId and secretKeyValue
  const [secretKeyId, secretKeyValue] = decodedWriteKey.split(":");

  const writeKeySecret = await prisma().secret.findUnique({
    where: {
      id: secretKeyId,
    },
  });

  // Compare the secretKeyValue with the value from the database
  return writeKeySecret?.value === secretKeyValue;
}

export async function createWriteKey({
  writeKeyValue,
  writeKeyName,
  workspaceId,
}: {
  workspaceId: string;
  writeKeyValue: string;
  writeKeyName: string;
}): Promise<string> {
  const secretId = await prisma().$transaction(async (tx) => {
    // Try to find the secret, create if it doesn't exist
    const secret = await tx.secret.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: writeKeyName,
        },
      },
      update: {},
      create: {
        workspaceId,
        name: writeKeyName,
        value: writeKeyValue,
      },
    });

    // Try to find the writeKey, create if it doesn't exist
    await tx.writeKey.upsert({
      where: {
        workspaceId_secretId: {
          workspaceId,
          secretId: secret.id,
        },
      },
      update: {},
      create: {
        workspaceId,
        secretId: secret.id,
      },
    });
    return secret.id;
  });

  return Buffer.from(`${secretId}:${writeKeyValue}`).toString("base64");
}
