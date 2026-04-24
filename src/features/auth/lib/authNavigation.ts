import type { NavigateFunction } from "react-router-dom";

import { buildPostAuthSuccessUrl, buildSsoStartUrl } from "@features/auth/api/auth.ts";

type AuthLocationLike = {
  hash?: string;
  pathname: string;
  search?: string;
};

type BrowserRedirectMode = "assign" | "replace";

function isAuthTransitionPath(pathname: string): boolean {
  return pathname === "/signin" || pathname.startsWith("/auth/");
}

function buildLocationNextPath(location: AuthLocationLike): string {
  return `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`;
}

function redirectBrowser(url: string, mode: BrowserRedirectMode = "replace"): void {
  if (typeof window === "undefined") return;

  if (mode === "assign") {
    window.location.assign(url);
    return;
  }

  window.location.replace(url);
}

function redirectToSsoStart(nextPath: string, mode: BrowserRedirectMode = "replace"): void {
  redirectBrowser(buildSsoStartUrl(nextPath), mode);
}

function redirectAfterAuthSuccess(nextPath: string, navigate: NavigateFunction): void {
  const successRedirectUrl = buildPostAuthSuccessUrl(nextPath);
  if (/^https?:\/\//.test(successRedirectUrl)) {
    redirectBrowser(successRedirectUrl);
    return;
  }

  navigate(successRedirectUrl, { replace: true });
}

export {
  buildLocationNextPath,
  isAuthTransitionPath,
  redirectAfterAuthSuccess,
  redirectToSsoStart,
};
export type { AuthLocationLike, BrowserRedirectMode };
