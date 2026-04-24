import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import {
  bootstrapAuth,
  isAuthTransitionPath,
  selectAuthInitialized,
  selectAuthStatus,
} from "@features/auth/index.ts";
import type { AuthBootstrapProps } from "@app/provider/AuthBootstrap.types.ts";

/**
 * 앱 시작 시 인증 초기화 thunk를 실행합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function AuthBootstrap({ children }: AuthBootstrapProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectAuthInitialized);
  const status = useAppSelector(selectAuthStatus);
  const pathname = typeof window === "undefined" ? null : window.location.pathname;
  const shouldSkipBootstrap = pathname ? isAuthTransitionPath(pathname) : false;

  useEffect(() => {
    if (shouldSkipBootstrap) return;
    if (initialized || status === "loading") return;
    void dispatch(bootstrapAuth());
  }, [dispatch, initialized, shouldSkipBootstrap, status]);

  if (!shouldSkipBootstrap && (!initialized || status === "loading")) {
    return <div style={{ padding: 32 }}>인증 상태를 확인하는 중입니다...</div>;
  }

  return <>{children}</>;
}

export { AuthBootstrap };
