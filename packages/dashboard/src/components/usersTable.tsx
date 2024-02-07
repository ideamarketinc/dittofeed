import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import {
  DataGrid,
  GridColDef,
  GridSlotsComponentsProps,
} from "@mui/x-data-grid";
import { Type } from "@sinclair/typebox";
import {
  CompletionStatus,
  CursorDirectionEnum,
  EphemeralRequestStatus,
  GetUsersRequest,
  GetUsersResponse,
  GetUsersResponseItem,
} from "isomorphic-lib/src/types";
import { NextRouter, useRouter } from "next/router";
import React, { useMemo } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import apiRequestHandlerFactory from "../lib/apiRequestHandlerFactory";
import { useAppStore } from "../lib/appStore";
import { monospaceCell } from "../lib/datagridCells";
import { propertiesStore } from "../lib/filterStore";

export const UsersTableParams = Type.Pick(GetUsersRequest, [
  "cursor",
  "direction",
]);

export function usersTablePaginationHandler(router: NextRouter) {
  const onUsersTablePaginate = ({
    direction,
    cursor,
  }: OnPaginationChangeProps) => {
    router.push({
      pathname: router.pathname,
      query: {
        ...router.query,
        direction,
        cursor,
      },
    });
  };
  return onUsersTablePaginate;
}

interface Row {
  id: string;
  properties: string;
  segments: string;
}

const baseColumn: Partial<GridColDef<Row>> = {
  flex: 1,
  sortable: false,
  filterable: false,
  renderCell: monospaceCell,
};

declare module "@mui/x-data-grid" {
  interface FooterPropsOverrides {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    onNextPage: () => void;
    onPreviousPage: () => void;
    status: "a" | "b";
  }
}

function CustomPagination(props: GridSlotsComponentsProps["footer"]) {
  const { hasNextPage, hasPreviousPage, onNextPage, onPreviousPage } =
    props ?? {};

  return (
    <Box display="flex" justifyContent="center" alignItems="center">
      <IconButton disabled={!hasPreviousPage} onClick={onPreviousPage}>
        <KeyboardArrowLeft />
      </IconButton>
      <IconButton disabled={!hasNextPage} onClick={onNextPage}>
        <KeyboardArrowRight />
      </IconButton>
    </Box>
  );
}

interface UsersState {
  users: Record<string, GetUsersResponseItem>;
  currentPageUserIds: string[];
  getUsersRequest: EphemeralRequestStatus<Error>;
  previousCursor: string | null;
  nextCursor: string | null;
}

interface UsersActions {
  setUsers: (val: GetUsersResponseItem[]) => void;
  setUsersPage: (val: string[]) => void;
  setGetUsersRequest: (val: EphemeralRequestStatus<Error>) => void;
  setPreviousCursor: (val: string | null) => void;
  setNextCursor: (val: string | null) => void;
}

export const usersStore = create(
  immer<UsersState & UsersActions>((set) => ({
    users: {},
    currentPageUserIds: [],
    getUsersRequest: {
      type: CompletionStatus.NotStarted,
    },
    nextCursor: null,
    previousCursor: null,
    setUsers: (users) =>
      set((state) => {
        for (const user of users) {
          state.users[user.id] = user;
        }
      }),
    setUsersPage: (ids) =>
      set((state) => {
        state.currentPageUserIds = ids;
      }),
    setGetUsersRequest: (request) =>
      set((state) => {
        state.getUsersRequest = request;
      }),
    setPreviousCursor: (cursor) =>
      set((state) => {
        state.previousCursor = cursor;
      }),
    setNextCursor: (cursor) =>
      set((state) => {
        state.nextCursor = cursor;
      }),
  })),
);

export type OnPaginationChangeProps = Pick<
  GetUsersRequest,
  "direction" | "cursor"
>;

export type UsersTableProps = Omit<GetUsersRequest, "limit"> & {
  onPaginationChange: (args: OnPaginationChangeProps) => void;
};

export default function UsersTable({
  workspaceId,
  segmentFilter: segmentId,
  direction,
  cursor,
  onPaginationChange,
}: UsersTableProps) {
  const router = useRouter();
  const apiBase = useAppStore((store) => store.apiBase);
  const getUsersRequest = usersStore((store) => store.getUsersRequest);
  const users = usersStore((store) => store.users);
  const nextCursor = usersStore((store) => store.nextCursor);
  const previousCursor = usersStore((store) => store.previousCursor);
  const currentPageUserIds = usersStore((store) => store.currentPageUserIds);
  const setGetUsersRequest = usersStore((store) => store.setGetUsersRequest);
  const setNextCursor = usersStore((store) => store.setNextCursor);
  const setUsers = usersStore((store) => store.setUsers);
  const setUsersPage = usersStore((store) => store.setUsersPage);
  const setPreviousCursor = usersStore((store) => store.setPreviousCursor);

  // used to filter by property
  const propertyFilter = propertiesStore((store) => store.userPropertyFilter);
  const userPropertyFilter = useMemo(
    () => Object.values(propertyFilter),
    [propertyFilter],
  );
  const segmentFilterFromStore = propertiesStore(
    (store) => store.segmentFilter,
  );
  const segmentFilter: string[] = useMemo(
    () =>
      segmentId
        ? ([...segmentFilterFromStore, segmentId] as string[])
        : segmentFilterFromStore,
    [segmentFilterFromStore],
  );

  const usersPage = useMemo(
    () =>
      currentPageUserIds.flatMap((id) => {
        const user = users[id];
        if (!user) {
          return [];
        }
        const userProperties: Record<string, string> = {};
        for (const propertyId in user.properties) {
          const property = user.properties[propertyId];
          if (!property) {
            continue;
          }
          userProperties[property.name] = property.value;
        }
        const segments = user.segments.map((segment) => segment.name);

        return {
          id: user.id,
          properties: JSON.stringify(userProperties),
          segments: segments.join(" "),
        };
      }),
    [currentPageUserIds, users],
  );

  React.useEffect(() => {
    const setLoadResponse = (response: GetUsersResponse) => {
      if (response.users.length === 0 && cursor) {
        if (direction === CursorDirectionEnum.Before) {
          setNextCursor(null);
          setPreviousCursor(null);
          onPaginationChange({});
        }
      } else {
        setUsers(response.users);
        setUsersPage(response.users.map((u) => u.id));
        setNextCursor(response.nextCursor ?? null);
        setPreviousCursor(response.previousCursor ?? null);
      }
    };

    const params: GetUsersRequest = {
      segmentFilter: segmentFilter.length > 0 ? segmentFilter : undefined,
      cursor,
      direction,
      workspaceId,
      userPropertyFilter:
        userPropertyFilter.length > 0 ? userPropertyFilter : undefined,
    };

    const handler = apiRequestHandlerFactory({
      request: getUsersRequest,
      setRequest: setGetUsersRequest,
      responseSchema: GetUsersResponse,
      setResponse: setLoadResponse,
      requestConfig: {
        method: "POST",
        url: `${apiBase}/api/users`,
        data: JSON.stringify(params),
        headers: {
          "Content-Type": "application/json",
        },
      },
    });
    handler();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentFilter, cursor, direction, userPropertyFilter, segmentFilter]);

  const isLoading = getUsersRequest.type === CompletionStatus.InProgress;

  return (
    <DataGrid
      rows={usersPage}
      sx={{
        height: "100%",
        width: "100%",
        // disable cell selection style
        ".MuiDataGrid-cell:focus": {
          outline: "none",
        },
        // pointer cursor on ALL rows
        "& .MuiDataGrid-row:hover": {
          cursor: "pointer",
        },
      }}
      getRowId={(row) => row.id}
      onRowClick={(params) => {
        router.push({
          pathname: `/users/${params.id}`,
        });
      }}
      autoHeight
      columns={[
        {
          field: "id",
        },
        {
          field: "properties",
        },
        {
          field: "segments",
        },
      ].map((c) => ({ ...baseColumn, ...c }))}
      loading={isLoading}
      slots={{
        footer: CustomPagination,
      }}
      slotProps={{
        footer: {
          hasNextPage: !!nextCursor,
          hasPreviousPage: !!previousCursor,
          onNextPage: () =>
            onPaginationChange({
              cursor: nextCursor ?? undefined,
              direction: CursorDirectionEnum.After,
            }),

          onPreviousPage: () =>
            onPaginationChange({
              cursor: previousCursor ?? undefined,
              direction: CursorDirectionEnum.Before,
            }),
        },
      }}
    />
  );
}
