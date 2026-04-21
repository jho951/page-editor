/**
 * 애플리케이션 전체 reducer를 결합합니다.
 */

import { combineReducers } from "@reduxjs/toolkit";

import { layoutReducer } from "@features/layout/index.ts";
import { shortcutsReducer } from "@features/shortcuts/index.ts";
import { authReducer } from "@features/auth/index.ts";
import { editorReducer } from "@features/editor/index.ts";

import { uiReducer } from "@app/state/ui.slice.ts";

/**
 * root Reducer reducer입니다.
 */
const rootReducer = combineReducers({
  layout: layoutReducer,
  shortcut: shortcutsReducer,
  auth: authReducer,
  editor: editorReducer,
  ui: uiReducer,
});

export { rootReducer };
