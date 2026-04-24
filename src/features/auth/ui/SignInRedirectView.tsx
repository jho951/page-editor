/**
 * 로그인 시작 경로를 계산해 인증 진입점으로 이동시킵니다.
 */

import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { resolveNextPathFromParams } from "@features/auth/api/auth.ts";
import { redirectToSsoStart } from "@features/auth/lib/authNavigation.ts";

/**
 * 로그인 진입 경로를 계산해 인증 시작 페이지로 이동시킵니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function SignInRedirectView(): React.ReactElement {
    const [params] = useSearchParams();

    const nextPath = resolveNextPathFromParams(params);

    useEffect(() => {
        redirectToSsoStart(nextPath);
    }, [nextPath]);

    return <span>로그인 시작 페이지로 이동 중입니다...</span>;
}

export { SignInRedirectView };
