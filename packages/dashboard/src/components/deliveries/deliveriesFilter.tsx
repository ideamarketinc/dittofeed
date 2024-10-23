import { AddCircleOutline } from "@mui/icons-material";
import {
  Autocomplete,
  AutocompleteProps,
  Button,
  Chip,
  Paper,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import Popover from "@mui/material/Popover";
import { assertUnreachable } from "isomorphic-lib/src/typeAssertions";
import {
  ChannelType,
  CompletionStatus,
  InternalEventType,
  Present,
} from "isomorphic-lib/src/types";
import React, { useCallback, useMemo, useRef } from "react";
import { Updater, useImmer } from "use-immer";

import { useAppStorePick } from "../../lib/appStore";

export interface BaseDeliveriesFilterCommand {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export enum DeliveriesFilterCommandType {
  SelectItem = "SelectItem",
  SelectKey = "SelectKey",
}

export type Key = "template" | "status" | "to" | "from" | "channel";

export type SelectItemCommand = BaseDeliveriesFilterCommand & {
  type: DeliveriesFilterCommandType.SelectItem;
  id: string;
};

export type SelectKeyCommand = BaseDeliveriesFilterCommand & {
  type: DeliveriesFilterCommandType.SelectKey;
  filterKey: Key;
};

export type DeliveriesFilterCommand = SelectItemCommand | SelectKeyCommand;

type CommandHandler = Present<
  AutocompleteProps<DeliveriesFilterCommand, false, false, false>["onChange"]
>;

export enum FilterType {
  Key = "Key",
  Value = "Value",
}

export interface NameIdFilter {
  type: FilterType.Key;
  // Map of filter ID to filter label
  value: Map<string, string>;
}

export interface ValueFilter {
  type: FilterType.Value;
  value: string;
}

export type Filter = NameIdFilter | ValueFilter;

export enum StageType {
  SelectKey = "SelectKey",
  SelectItem = "SelectItem",
  SelectValue = "SelectValue",
}

export interface SelectKeyStage {
  type: StageType.SelectKey;
}

export interface SelectItemStage {
  type: StageType.SelectItem;
  filterKey: Key;
  children: SelectItemCommand[];
}
export interface SelectValueStage {
  type: StageType.SelectValue;
  label: string;
  filterKey: Key;
  value: Filter;
}

export type Stage = SelectKeyStage | SelectItemStage | SelectValueStage;

export interface DeliveriesState {
  open: boolean;
  anchorEl: HTMLElement | null;
  inputValue: string;
  stage: Stage;
  filters: Map<
    // Filter Key e.g. templateId
    Key,
    Filter
  >;
}

type SetDeliveriesState = Updater<DeliveriesState>;

export function useDeliveriesFilterState(): [
  DeliveriesState,
  SetDeliveriesState,
] {
  return useImmer<DeliveriesState>({
    open: false,
    anchorEl: null,
    inputValue: "",
    stage: { type: StageType.SelectKey },
    filters: new Map(),
  });
}

export function SelectedDeliveriesFilters({
  state,
  setState,
}: {
  state: DeliveriesState;
  setState: SetDeliveriesState;
}) {
  const filterChips = Array.from(state.filters.entries()).map(
    ([key, filters]) => {
      let label: string;
      switch (filters.type) {
        case FilterType.Key: {
          label = Array.from(filters.value.values()).join(" OR ");
          break;
        }
        case FilterType.Value: {
          label = filters.value;
          break;
        }
      }
      return (
        <Chip
          key={key}
          label={`${key} = ${label}`}
          onDelete={() =>
            setState((draft) => {
              draft.filters.delete(key as Key);
            })
          }
        />
      );
    },
  );
  return <>{filterChips}</>;
}

export function NewDeliveriesFilterButton({
  state,
  setState,
}: {
  state: DeliveriesState;
  setState: SetDeliveriesState;
}) {
  const theme = useTheme();
  const { messages } = useAppStorePick(["messages"]);
  const { stage } = state;
  const inputRef = useRef<HTMLInputElement>(null);
  const commands: DeliveriesFilterCommand[] = useMemo(() => {
    switch (stage.type) {
      case StageType.SelectKey: {
        return [
          {
            label: "Template",
            type: DeliveriesFilterCommandType.SelectKey,
            filterKey: "template",
          },
          {
            label: "To",
            type: DeliveriesFilterCommandType.SelectKey,
            filterKey: "to",
          },
          {
            label: "From",
            type: DeliveriesFilterCommandType.SelectKey,
            filterKey: "from",
          },
          {
            label: "Status",
            type: DeliveriesFilterCommandType.SelectKey,
            filterKey: "status",
          },
        ];
      }
      case StageType.SelectValue: {
        return [];
      }
      case StageType.SelectItem: {
        return stage.children;
      }
      default:
        assertUnreachable(stage);
    }
  }, [stage]);

  const handleCommandSelect = useCallback<CommandHandler>(
    (_event, value) => {
      if (value) {
        switch (value.type) {
          case DeliveriesFilterCommandType.SelectItem:
            setState((draft) => {
              const { stage: currentStage } = draft;
              if (currentStage.type !== StageType.SelectItem) {
                return draft;
              }
              draft.inputValue = "";
              draft.open = false;
              const maybeExisting = draft.filters.get(currentStage.filterKey);
              if (maybeExisting?.type === FilterType.Value) {
                console.error("Expected key filter value");
                return draft;
              }
              const existing = maybeExisting ?? {
                type: FilterType.Key,
                value: new Map(),
              };

              existing.value.set(value.id, value.label);
              draft.filters.set(currentStage.filterKey, existing);
              return draft;
            });
            break;
          case DeliveriesFilterCommandType.SelectKey:
            setState((draft) => {
              switch (value.filterKey) {
                case "template": {
                  const templates =
                    messages.type === CompletionStatus.Successful
                      ? messages.value
                      : [];

                  const children: SelectItemCommand[] = templates.map(
                    (template) => ({
                      label: template.name,
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: template.id,
                    }),
                  );
                  draft.stage = {
                    type: StageType.SelectItem,
                    filterKey: value.filterKey,
                    children,
                  };
                  break;
                }
                case "to":
                  draft.stage = {
                    type: StageType.SelectValue,
                    filterKey: value.filterKey,
                    label: value.label,
                    value: {
                      type: FilterType.Value,
                      value: "",
                    },
                  };
                  break;
                case "from":
                  draft.stage = {
                    type: StageType.SelectValue,
                    filterKey: value.filterKey,
                    label: value.label,
                    value: {
                      type: FilterType.Value,
                      value: "",
                    },
                  };
                  break;
                case "status": {
                  const children: SelectItemCommand[] = [
                    {
                      label: "Sent",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.MessageSent,
                    },
                    {
                      label: "Email Bounced",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailBounced,
                    },
                    {
                      label: "Email Marked as Spam",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailMarkedSpam,
                    },
                    {
                      label: "Email Opened",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailOpened,
                    },
                    {
                      label: "Email Link Clicked",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailClicked,
                    },
                    {
                      label: "Email Delivered",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailDelivered,
                    },
                    {
                      label: "Email Bounced",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailDelivered,
                    },
                    {
                      label: "Email Dropped",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.EmailDropped,
                    },
                    {
                      label: "Sms Delivered",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.SmsDelivered,
                    },
                    {
                      label: "Sms Failed",
                      type: DeliveriesFilterCommandType.SelectItem,
                      id: InternalEventType.SmsFailed,
                    },
                  ];
                  draft.stage = {
                    type: StageType.SelectItem,
                    filterKey: value.filterKey,
                    children,
                  };
                  break;
                }
                case "channel": {
                  const children: SelectItemCommand[] = [
                    {
                      label: "Email",
                      id: ChannelType.Email,
                      type: DeliveriesFilterCommandType.SelectItem,
                    },
                    {
                      label: "SMS",
                      id: ChannelType.Sms,
                      type: DeliveriesFilterCommandType.SelectItem,
                    },
                    {
                      label: "Webhook",
                      id: ChannelType.Webhook,
                      type: DeliveriesFilterCommandType.SelectItem,
                    },
                  ];

                  draft.stage = {
                    type: StageType.SelectItem,
                    filterKey: value.filterKey,
                    children,
                  };
                  break;
                }
              }
            });
            break;
          default:
            assertUnreachable(value);
        }
      }
    },
    [setState, messages],
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setState((draft) => {
      draft.anchorEl = event.currentTarget;
      draft.open = true;
    });
  };

  const handleClose = () => {
    setState((draft) => {
      draft.anchorEl = null;
      draft.open = false;
      draft.stage = { type: StageType.SelectKey };
    });
  };

  let popoverBody: React.ReactNode;
  if (state.stage.type === StageType.SelectValue) {
    popoverBody = (
      <TextField
        autoFocus
        label={state.stage.label}
        value={state.stage.value.value}
        ref={inputRef}
        onChange={(event) =>
          setState((draft) => {
            if (draft.stage.type !== StageType.SelectValue) {
              return draft;
            }
            draft.stage.value.value = event.target.value;
            return draft;
          })
        }
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }
          event.preventDefault();

          const value = state.inputValue;
          setState((draft) => {
            if (draft.stage.type !== StageType.SelectValue) {
              return draft;
            }
            // Set the filter
            draft.filters.set(draft.stage.filterKey, {
              type: FilterType.Value,
              value,
            });
            // Reset and close
            draft.open = false;
            draft.stage = { type: StageType.SelectKey };
            draft.inputValue = "";
            return draft;
          });
        }}
      />
    );
  } else {
    popoverBody = (
      <Autocomplete
        disablePortal
        open
        ListboxProps={{
          sx: {
            padding: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          },
        }}
        inputValue={state.inputValue}
        disableClearable
        onInputChange={(event, newInputValue) =>
          setState((draft) => {
            draft.inputValue = newInputValue;
          })
        }
        options={commands}
        getOptionLabel={(option) => option.label}
        onChange={handleCommandSelect}
        renderInput={(params) => (
          <TextField {...params} autoFocus label="Settings" variant="filled" />
        )}
        renderOption={(props, option) => (
          <Paper
            component="li"
            {...props}
            sx={{
              opacity: option.disabled ? 0.5 : 1,
              pointerEvents: option.disabled ? "none" : "auto",
              borderRadius: 0,
              width: 300,
            }}
          >
            <Typography
              variant="body2"
              style={{ display: "flex", alignItems: "center" }}
            >
              {option.icon}
              <span style={{ marginLeft: "8px" }}>{option.label}</span>
            </Typography>
          </Paper>
        )}
        getOptionDisabled={(option) => option.disabled ?? false}
        sx={{ width: 300, padding: 0, height: "100%" }}
      />
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        startIcon={<AddCircleOutline />}
        size="small"
        sx={{
          color: theme.palette.grey[800],
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        Add Filter
      </Button>
      <Popover
        open={state.open}
        anchorEl={state.anchorEl}
        onClose={handleClose}
        TransitionProps={{
          onEntered: () => {
            console.log("onEntered loc1");
            inputRef.current?.focus();
          },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        sx={{
          "& .MuiPopover-paper": {
            overflow: "visible",
          },
        }}
      >
        {popoverBody}
      </Popover>
    </>
  );
}
