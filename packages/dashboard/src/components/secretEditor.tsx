import { Visibility, VisibilityOff } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import {
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import {
  CompletionStatus,
  EmptyResponse,
  EphemeralRequestStatus,
  UpsertSecretRequest,
} from "isomorphic-lib/src/types";
import { useImmer } from "use-immer";

import apiRequestHandlerFactory from "../lib/apiRequestHandlerFactory";
import { useAppStorePick } from "../lib/appStore";

export enum SecretStateType {
  Saved = "Saved",
  SavedEditing = "SavedEditing",
  UnSaved = "UnSaved",
}

export interface SavedSecretState {
  type: SecretStateType.Saved;
}

export interface SavedEditingSecretState {
  value: string;
  type: SecretStateType.SavedEditing;
}

export interface UnSavedSecretState {
  value: string;
  type: SecretStateType.UnSaved;
}

export type EditingSecretState =
  | SavedEditingSecretState
  | UnSavedSecretState
  | SavedSecretState;

export interface SecretState {
  showValue: boolean;
  updateRequest: EphemeralRequestStatus<Error>;
  editingState: EditingSecretState;
}

export interface SecretEditorProps {
  // the name of the secret config referenced by this component
  name: string;
  // the key within the secret config referenced by this component
  secretKey: string;
  // whether the secret is saved or not on page load
  saved: boolean;
  // used to describe the secret in the UI
  title: string;
  // type of secret, passed in payload
  type: string;
}

function initialState(saved: boolean): SecretState {
  return {
    showValue: false,
    updateRequest: {
      type: CompletionStatus.NotStarted,
    },
    editingState: saved
      ? { type: SecretStateType.Saved }
      : { type: SecretStateType.UnSaved, value: "" },
  };
}

function toggleVisibility(state: SecretState) {
  state.showValue = !state.showValue;
}

function disableSavedEditing(state: SecretState): SecretState {
  const newEditingState: SavedSecretState = {
    type: SecretStateType.Saved,
  };

  return {
    ...state,
    editingState: newEditingState,
  };
}

function SecretTextField({
  showValue,
  onVisibilityChange,
  autoFocus,
  onChange,
}: {
  autoFocus?: boolean;
  onVisibilityChange: () => void;
  showValue: boolean;
  onChange: React.ComponentProps<typeof TextField>["onChange"];
}) {
  return (
    <TextField
      autoFocus={autoFocus}
      type={showValue ? "text" : "password"}
      sx={{ flex: 1 }}
      onChange={onChange}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label="toggle secret visibility"
              onClick={onVisibilityChange}
              onMouseDown={onVisibilityChange}
            >
              {showValue ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

function setRequest(request: EphemeralRequestStatus<Error>) {
  return (state: SecretState) => {
    state.updateRequest = request;
  };
}

export default function SecretEditor({
  name,
  saved,
  secretKey,
  title,
  type,
}: SecretEditorProps) {
  const { workspace: workspaceResult, apiBase } = useAppStorePick([
    "workspace",
    "apiBase",
  ]);

  const [{ editingState, updateRequest, showValue }, setState] =
    useImmer<SecretState>(() => initialState(saved));

  if (workspaceResult.type !== CompletionStatus.Successful) {
    return null;
  }
  let field: React.ReactNode;
  switch (editingState.type) {
    case SecretStateType.Saved: {
      const deleteHandler = apiRequestHandlerFactory({
        request: updateRequest,
        setRequest: (request) => setState(setRequest(request)),
        responseSchema: EmptyResponse,
        onSuccessNotice: `Successfully deleted ${title}`,
        setResponse: () => {
          setState((draft) => {
            draft.editingState = {
              type: SecretStateType.UnSaved,
              value: "",
            };
          });
        },
        onFailureNoticeHandler: () => `API Error: Failed to update ${title}`,
        requestConfig: {
          method: "PUT",
          url: `${apiBase}/api/secrets`,
          data: {
            workspaceId: workspaceResult.value.id,
            name,
            configValue: {
              [secretKey]: "",
            },
          } satisfies UpsertSecretRequest,
          headers: {
            "Content-Type": "application/json",
          },
        },
      });

      field = (
        <>
          <TextField disabled placeholder="**********" sx={{ flex: 1 }} />
          <Button
            onClick={() => {
              setState((draft) => {
                draft.editingState = {
                  type: SecretStateType.SavedEditing,
                  value: "",
                };
              });
            }}
          >
            Update
          </Button>
          <LoadingButton
            loading={updateRequest.type === CompletionStatus.InProgress}
            onClick={deleteHandler}
          >
            Delete
          </LoadingButton>
        </>
      );
      break;
    }
    case SecretStateType.SavedEditing: {
      const updateHandler = apiRequestHandlerFactory({
        request: updateRequest,
        setRequest: (request) => setState(setRequest(request)),
        responseSchema: EmptyResponse,
        onSuccessNotice: `Successfully updated ${title}`,
        onFailureNoticeHandler: () => `API Error: Failed to update ${title}`,
        setResponse: () => {
          setState((draft) => {
            draft.editingState = {
              type: SecretStateType.Saved,
            };
          });
        },
        requestConfig: {
          method: "PUT",
          url: `${apiBase}/api/secrets`,
          data: {
            workspaceId: workspaceResult.value.id,
            name,
            configValue: {
              [secretKey]: editingState.value,
            },
          } satisfies UpsertSecretRequest,
          headers: {
            "Content-Type": "application/json",
          },
        },
      });
      field = (
        <>
          <SecretTextField
            onChange={(e) => {
              setState((draft) => {
                if (draft.editingState.type !== SecretStateType.SavedEditing) {
                  return;
                }

                draft.editingState.value = e.target.value;
              });
            }}
            onVisibilityChange={() => setState(toggleVisibility)}
            showValue={showValue}
          />
          <LoadingButton
            loading={updateRequest.type === CompletionStatus.InProgress}
            onClick={updateHandler}
          >
            Save
          </LoadingButton>
          <Button onClick={() => setState(disableSavedEditing)}>Cancel</Button>
        </>
      );
      break;
    }
    case SecretStateType.UnSaved: {
      const updateHandler = apiRequestHandlerFactory({
        request: updateRequest,
        setRequest: (request) => setState(setRequest(request)),
        responseSchema: EmptyResponse,
        onSuccessNotice: `Successfully updated ${title}`,
        onFailureNoticeHandler: () => `API Error: Failed to update ${title}`,
        setResponse: () => {
          setState((draft) => {
            draft.editingState = {
              type: SecretStateType.Saved,
            };
          });
        },
        requestConfig: {
          method: "PUT",
          url: `${apiBase}/api/secrets`,
          data: {
            workspaceId: workspaceResult.value.id,
            name,
            configValue: {
              type,
              [secretKey]: editingState.value,
            },
          } satisfies UpsertSecretRequest,
          headers: {
            "Content-Type": "application/json",
          },
        },
      });
      field = (
        <>
          <SecretTextField
            onVisibilityChange={() => setState(toggleVisibility)}
            onChange={(e) => {
              setState((draft) => {
                if (draft.editingState.type !== SecretStateType.UnSaved) {
                  return;
                }

                draft.editingState.value = e.target.value;
              });
            }}
            showValue={showValue}
          />
          <LoadingButton
            loading={updateRequest.type === CompletionStatus.InProgress}
            onClick={updateHandler}
          >
            Save
          </LoadingButton>
        </>
      );
      break;
    }
  }

  return (
    <Stack
      direction="row"
      className="secret-editor"
      alignItems="center"
      spacing={1}
      sx={{ width: "100%" }}
    >
      {field}
    </Stack>
  );
}
