/**
 * 애플리케이션 전역 UI 상태를 관리합니다.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

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

export interface UiState {
  contextMenu: ContextMenuState;
}

/**
 * UI slice의 초기 상태입니다.
 */
const initialState: UiState = {
  contextMenu: { open: false, x: 0, y: 0, items: [] },
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
