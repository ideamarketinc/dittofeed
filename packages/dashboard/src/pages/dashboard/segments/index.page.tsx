import { AddCircleOutline } from "@mui/icons-material";
import {
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import backendConfig from "backend-lib/src/config";
import { CompletionStatus, SegmentResource } from "isomorphic-lib/src/types";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { v4 as uuid } from "uuid";

import MainLayout from "../../../components/mainLayout";
import {
  addInitialStateToProps,
  PropsWithInitialState,
  useAppStore,
} from "../../../lib/appStore";
import prisma from "../../../lib/prisma";
import { AppState } from "../../../lib/types";

export const getServerSideProps: GetServerSideProps<
  PropsWithInitialState
> = async () => {
  // Dynamically import to avoid transitively importing backend config at build time.
  const { toSegmentResource } = await import("backend-lib/src/segments");

  const workspaceId = backendConfig().defaultWorkspaceId;
  const segmentResources: SegmentResource[] = (
    await prisma().segment.findMany({
      where: { workspaceId },
    })
  ).flatMap((segment) => {
    const result = toSegmentResource(segment);
    if (result.isErr()) {
      return [];
    }
    return result.value;
  });
  const segments: AppState["segments"] = {
    type: CompletionStatus.Successful,
    value: segmentResources,
  };
  return {
    props: addInitialStateToProps(
      {},
      {
        segments,
      }
    ),
  };
};

function SegmentItem({ segment }: { segment: SegmentResource }) {
  const path = useRouter();

  return (
    <ListItem disableGutters>
      <ListItemButton
        sx={{
          border: 1,
          borderRadius: 1,
          borderColor: "grey.200",
        }}
        onClick={() => {
          path.push(`/dashboard/segments/${segment.id}`);
        }}
      >
        <ListItemText primary={segment.name} />
      </ListItemButton>
    </ListItem>
  );
}

function SegmentListContents() {
  const path = useRouter();
  const segmentsResult = useAppStore((store) => store.segments);
  const segments =
    segmentsResult.type === CompletionStatus.Successful
      ? segmentsResult.value
      : [];

  let innerContents;
  if (segments.length) {
    innerContents = (
      <List
        sx={{
          padding: 1,
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: 1,
        }}
      >
        {segments.map((segment) => (
          <SegmentItem segment={segment} key={segment.id} />
        ))}
      </List>
    );
  } else {
    innerContents = null;
  }

  return (
    <Stack
      sx={{
        padding: 1,
        width: "100%",
        maxWidth: "40rem",
      }}
      spacing={2}
    >
      <Stack direction="row" justifyContent="space-between">
        <Typography sx={{ padding: 1 }} variant="h5">
          Segments
        </Typography>
        <IconButton
          onClick={() => {
            path.push(`/dashboard/segments/${uuid()}`);
          }}
        >
          <AddCircleOutline />
        </IconButton>
      </Stack>
      {innerContents}
    </Stack>
  );
}
export default function SegmentList() {
  return (
    <>
      <Head>
        <title>Dittofeed</title>
        <meta name="description" content="Open Source Customer Engagement" />
      </Head>
      <main>
        <MainLayout>
          <SegmentListContents />
        </MainLayout>
      </main>
    </>
  );
}
