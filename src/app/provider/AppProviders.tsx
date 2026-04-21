import React from "react";
import { Provider as ReduxProvider } from "react-redux";

import { store } from "@app/store/store";
import { ThemeProvider } from "@app/provider/ThemeProvider";
import { ShortcutProvider } from "@app/provider/ShortcutProvider";
import type { ProvidersProps } from "@app/provider/provider.types";
import { ContextMenuHost } from "@app/provider/ContextMenuHost.tsx";
import { AuthBootstrap } from "@app/provider/AuthBootstrap.tsx";

if (typeof window !== "undefined") {
  window.__APP_STORE__ = store;
  let previousEditor = store.getState().editor;
  store.subscribe(() => {

    const nextEditor = store.getState().editor;
    if (nextEditor === previousEditor) return;
    previousEditor = nextEditor;
    console.log("[redux] editor", nextEditor);
  });
}

/**
 * 앱 전역 provider들을 한곳에서 조합합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function AppProviders({ children }: ProvidersProps): React.ReactElement {
  return (
    <ReduxProvider store={store}>
      <AuthBootstrap>
        <ThemeProvider>
          <ShortcutProvider>
            {children}
            <ContextMenuHost />
          </ShortcutProvider>
        </ThemeProvider>
      </AuthBootstrap>
    </ReduxProvider>
  );
}

export { AppProviders };
