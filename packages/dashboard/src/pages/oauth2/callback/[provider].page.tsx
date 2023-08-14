import axios from "axios";
import backendConfig from "backend-lib/src/config";
import {
  HUBSPOT_INTEGRATION,
  HUBSPOT_OAUTH_TOKEN,
} from "isomorphic-lib/src/constants";
import { GetServerSideProps } from "next";

import prisma from "../../../lib/prisma";
import { requestContext } from "../../../lib/requestContext";
import connectWorkflowClient from "backend-lib/src/temporal/connectWorkflowClient";
import hubspotWorkflow from "backend-lib/src/integrations/hubspotWorkflow";

export const getServerSideProps: GetServerSideProps = requestContext(
  async (ctx, dfContext) => {
    const { code, provider } = ctx.query;
    if (typeof code !== "string" || typeof provider !== "string") {
      console.error("malformed callback url");

      return {
        redirect: {
          permanent: false,
          destination: "/settings",
        },
      };
    }

    const { dashboardUrl, hubspotClientSecret, hubspotClientId } =
      backendConfig();

    if (!hubspotClientSecret) {
      throw new Error("missing hubspotClientSecret");
    }

    const formData = {
      grant_type: "authorization_code",
      client_id: hubspotClientId,
      client_secret: hubspotClientSecret,
      redirect_uri: `${dashboardUrl}/dashboard/oauth2/callback/hubspot`,
      code,
    };

    switch (provider) {
      case "hubspot": {
        const tokenResponse = await axios({
          method: "post",
          url: "https://api.hubapi.com/oauth/v1/token",
          data: formData,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        console.log("access_token", access_token);
        console.log("refresh_token", refresh_token);
        console.log("expires_in", expires_in);
        const [workflowClient] = await Promise.all([
          connectWorkflowClient(),
          prisma().oauthToken.upsert({
            where: {
              workspaceId_name: {
                workspaceId: dfContext.workspace.id,
                name: HUBSPOT_OAUTH_TOKEN,
              },
            },
            create: {
              workspaceId: dfContext.workspace.id,
              name: HUBSPOT_OAUTH_TOKEN,
              accessToken: access_token,
              refreshToken: refresh_token,
              expiresIn: expires_in,
            },
            update: {
              accessToken: access_token,
              refreshToken: refresh_token,
              expiresIn: expires_in,
            },
          }),
          prisma().integration.upsert({
            where: {
              workspaceId_name: {
                workspaceId: dfContext.workspace.id,
                name: HUBSPOT_INTEGRATION,
              },
            },
            create: {
              workspaceId: dfContext.workspace.id,
              name: HUBSPOT_INTEGRATION,
            },
            update: {
              enabled: true,
            },
          }),
        ]);
        await workflowClient.start(hubspotWorkflow, []);
        break;
      }
      default:
        console.error("unknown provider");
        return {
          redirect: {
            permanent: false,
            destination: "/settings",
          },
        };
    }
    return {
      redirect: {
        permanent: false,
        destination: "/settings",
      },
    };
  }
);

export default function CallbackPage() {
  throw new Error("CallbackPage should never be rendered");
}
