/**
 * 인증 초기화가 끝날 때까지 화면 진입을 제어합니다.
 */

import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppSelector } from "@app/store/hooks.ts";
import {
  selectAuthError,
  selectAuthInitialized,
  selectAuthStatus,
  selectIsAuthenticated,
} from "@features/auth/state/auth.selector.ts";
import {
  buildLocationNextPath,
  redirectToSsoStart,
} from "@features/auth/lib/authNavigation.ts";
import type { AuthGateProps } from "@features/auth/ui/AuthGate.types.ts";

/**
 * 인증 초기화가 끝날 때까지 하위 화면 렌더링을 제어합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function AuthGate({ children }: AuthGateProps): React.ReactElement {
  const location = useLocation();
  const initialized = useAppSelector(selectAuthInitialized);
  const status = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const error = useAppSelector(selectAuthError);
  const nextPath = buildLocationNextPath(location);

  useEffect(() => {
    if (!initialized || status === "loading" || isAuthenticated) return;
    redirectToSsoStart(nextPath);
  }, [initialized, isAuthenticated, nextPath, status]);

  if (!initialized || status === "loading") {
    return <div style={{ padding: 32 }}>인증 상태를 확인하는 중입니다...</div>;
  }

  if (!isAuthenticated) {
    return <div style={{ padding: 32 }}>{error ? `로그인 페이지로 이동 중입니다... ${error}` : "로그인 페이지로 이동 중입니다..."}</div>;
  }

  return children;
}

export { AuthGate };
