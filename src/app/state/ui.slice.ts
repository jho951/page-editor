/**
 * 애플리케이션 전역 UI 상태를 관리합니다.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { translate } from "@shared/i18n/runtime.ts";

export type ContextMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export type ContextMenuState =
  | {
      open: true;
      x: number;
      y: number;
      items: ContextMenuItem[];
    }
  | {
      open: false;
      x: 0;
      y: 0;
      items: [];
    };

export type ConfirmState =
  | {
      open: true;
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      danger: boolean;
      onConfirm: () => void;
    }
  | {
      open: false;
      title: "";
      message: "";
      confirmLabel: string;
      cancelLabel: string;
      danger: false;
      onConfirm: null;
    };

export interface UiState {
  contextMenu: ContextMenuState;
  confirm: ConfirmState;
  toast: {
    id: number;
    open: boolean;
    message: string;
    duration: number;
  };
}

/**
 * UI slice의 초기 상태입니다.
 */
const initialState: UiState = {
  contextMenu: { open: false, x: 0, y: 0, items: [] },
  confirm: {
    open: false,
    title: "",
    message: "",
    confirmLabel: translate("common.actions.confirm"),
    cancelLabel: translate("common.actions.cancel"),
    danger: false,
    onConfirm: null,
  },
  toast: { id: 0, open: false, message: "", duration: 3000 },
};

/**
 * UI 상태 reducer를 정의하는 slice입니다.
 */
const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    openContextMenu(state, action: PayloadAction<{ x: number; y: number; items: ContextMenuItem[] }>) {
      state.contextMenu = { open: true, x: action.payload.x, y: action.payload.y, items: action.payload.items };
    },
    closeContextMenu(state) {
      state.contextMenu = { open: false, x: 0, y: 0, items: [] };
    },
    openConfirm(
      state,
      action: PayloadAction<{
        title: string;
        message: string;
        onConfirm: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
        danger?: boolean;
      }>
    ) {
      state.confirm = {
        open: true,
        title: action.payload.title,
        message: action.payload.message,
        onConfirm: action.payload.onConfirm,
        confirmLabel: action.payload.confirmLabel ?? translate("common.actions.confirm"),
        cancelLabel: action.payload.cancelLabel ?? translate("common.actions.cancel"),
        danger: action.payload.danger ?? false,
      };
    },
    closeConfirm(state) {
      state.confirm = {
        open: false,
        title: "",
        message: "",
        confirmLabel: translate("common.actions.confirm"),
        cancelLabel: translate("common.actions.cancel"),
        danger: false,
        onConfirm: null,
      };
    },
    showToast(state, action: PayloadAction<{ message: string; duration?: number }>) {
      state.toast = {
        id: state.toast.id + 1,
        open: true,
        message: action.payload.message,
        duration: action.payload.duration ?? 3000,
      };
    },
    closeToast(state) {
      state.toast = { ...state.toast, open: false };
    },
  },
});

/**
 * UI slice 액션 모음입니다.
 */
export const uiActions = uiSlice.actions;

/**
 * UI slice reducer입니다.
 */
export const uiReducer = uiSlice.reducer;
