import type { AxiosRequestConfig } from "axios";
import { api, API_BASE_URL } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";

/** 로그인 전 경로를 세션에 저장할 때 사용하는 키입니다. */
const POST_LOGIN_REDIRECT_KEY = "auth.post_login_redirect";
const NEXT_QUERY_KEYS = ["next", "callbackUrl", "returnUrl", "redirect", "redirectUrl"] as const;

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
};

/**
 * 별도 시작 프론트엔드가 있으면 그 기본 주소를 반환합니다.
 *
 * @returns 시작 프론트엔드 기본 URL을 반환합니다.
 */
function getStartFrontendUrl(): string {
  if (typeof import.meta === "undefined") return "http://127.0.0.1:3000";

  const env = (import.meta as unknown as { env?: { VITE_START_FRONTEND_URL?: string } }).env;
  return env?.VITE_START_FRONTEND_URL ?? "http://127.0.0.1:3000";
}

/**
 * 로그인 완료 후 돌아올 콜백 URL을 생성합니다.
 *
 * @returns 인증 콜백 절대 URL을 반환합니다.
 */
function buildCallbackUrl(): string {
  if (typeof import.meta === "undefined") return "/auth/callback";

  const env = (import.meta as unknown as { env?: { VITE_SITE_URL?: string } }).env;

  const siteUrl = env?.VITE_SITE_URL;

  if (siteUrl) {
    return new URL("/auth/callback", siteUrl).toString();
  }

  if (typeof window === "undefined") return "/auth/callback";
  return new URL("/auth/callback", window.location.origin).toString();
}

function getConfiguredSiteOrigin(): string | null {
  try {
    const env = (import.meta as unknown as { env?: { VITE_SITE_URL?: string } }).env;
    const siteUrl = env?.VITE_SITE_URL;
    return siteUrl ? new URL(siteUrl).origin : null;
  } catch {
    return null;
  }
}

function readNextFromSearchParams(params: URLSearchParams): string | null {
  for (const key of NEXT_QUERY_KEYS) {
    const value = params.get(key);
    if (value && value.trim()) return value;
  }
  return null;
}

function decodeCandidates(raw: string): string[] {
  const candidates = new Set<string>([raw]);
  let current = raw;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (!decoded || decoded === current) break;
      candidates.add(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  return [...candidates];
}

function extractPathname(pathWithQueryOrHash: string): string {
  const questionIndex = pathWithQueryOrHash.indexOf("?");
  const hashIndex = pathWithQueryOrHash.indexOf("#");

  let endIndex = pathWithQueryOrHash.length;
  if (questionIndex >= 0) endIndex = Math.min(endIndex, questionIndex);
  if (hashIndex >= 0) endIndex = Math.min(endIndex, hashIndex);

  return pathWithQueryOrHash.slice(0, endIndex) || "/";
}

function isAuthOnlyNextPath(pathWithQueryOrHash: string): boolean {
  const pathname = extractPathname(pathWithQueryOrHash);
  return pathname === "/signin" || pathname.startsWith("/auth/");
}

function normalizeNextPath(nextPath: string, depth = 0): string {
  if (depth > 3) return "/";

  const raw = nextPath.trim();
  if (!raw) return "/";

  const siteOrigin = getConfiguredSiteOrigin();
  const windowOrigin = typeof window !== "undefined" ? window.location.origin : null;
  const baseOrigin = windowOrigin ?? siteOrigin;

  for (const candidate of decodeCandidates(raw)) {
    if (candidate.startsWith("/") && !candidate.startsWith("//")) {
      return isAuthOnlyNextPath(candidate) ? "/" : candidate;
    }
    if (candidate.startsWith("?")) {
      const nested = readNextFromSearchParams(new URLSearchParams(candidate.slice(1)));
      if (nested) return normalizeNextPath(nested, depth + 1);
      continue;
    }
    if (!baseOrigin) continue;
    try {
      const asUrl = new URL(candidate, baseOrigin);
      const nested = readNextFromSearchParams(asUrl.searchParams);
      if (nested) return normalizeNextPath(nested, depth + 1);

      if (windowOrigin && asUrl.origin === windowOrigin) {
        const sameOriginPath = `${asUrl.pathname}${asUrl.search}${asUrl.hash}` || "/";
        return isAuthOnlyNextPath(sameOriginPath) ? "/" : sameOriginPath;
      }
      if (siteOrigin && asUrl.origin === siteOrigin) {
        const sameSitePath = `${asUrl.pathname}${asUrl.search}${asUrl.hash}` || "/";
        return isAuthOnlyNextPath(sameSitePath) ? "/" : sameSitePath;
      }
    } catch {
      continue;
    }
  }

  return "/";
}

export function resolveNextPathFromParams(params: URLSearchParams, fallbackPath = "/"): string {
  const raw = readNextFromSearchParams(params) ?? fallbackPath;
  return normalizeNextPath(raw);
}

/**
 * 로그인 성공 후 되돌아갈 경로를 세션 스토리지에 저장합니다.
 *
 * @param path 저장하거나 이동할 경로 문자열입니다.
 * @returns 반환값이 없습니다.
 */
export function storePostLoginRedirect(path: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

/**
 * 저장해 둔 로그인 후 복귀 경로를 읽고 즉시 제거합니다.
 *
 * @returns 로그인 후 이동할 경로 문자열을 반환합니다.
 */
export function consumePostLoginRedirect(): string {
  if (typeof window === "undefined") return "/";

  const next = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) ?? "/";
  window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return next;
}

/**
 * SSO 로그인 시작 URL을 생성합니다.
 *
 * @param nextPath 로그인 후 돌아갈 경로 문자열입니다.
 * @returns 브라우저가 이동할 SSO 시작 URL을 반환합니다.
 */
export function buildSsoStartUrl(nextPath: string): string {
  const normalizedNext = normalizeNextPath(nextPath);
  storePostLoginRedirect(normalizedNext);

  if (typeof window === "undefined") return endpoints.authSsoStart;

  const base = API_BASE_URL || window.location.origin;

  const url = new URL(endpoints.authSsoStart, base);

  const callbackUrl = new URL(buildCallbackUrl());
  callbackUrl.searchParams.set("next", normalizedNext);
  url.searchParams.set("redirect_uri", callbackUrl.toString());
  return url.toString();
}

/**
 * SSO callback ticket 을 서버 세션으로 교환합니다.
 *
 * @param ticket 로그인 콜백에서 전달된 ticket 문자열입니다.
 * @returns 완료 시 void 를 반환합니다.
 */
export async function exchangeAuthTicket(ticket: string): Promise<void> {
  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) {
    throw new Error("ticket is required");
  }

  await api.post<void>(
    endpoints.authExchange,
    { ticket: normalizedTicket },
    { withCredentials: true } as AxiosRequestConfig,
  );
}

/**
 * 시작 프론트엔드의 로그인 페이지 URL을 생성합니다.
 *
 * @param nextPath 로그인 후 돌아갈 경로 문자열입니다.
 * @returns 시작 프론트엔드 로그인 URL을 반환합니다.
 */
export function buildStartFrontendSignInUrl(nextPath: string): string {
  const normalizedNext = normalizeNextPath(nextPath);
  storePostLoginRedirect(normalizedNext);

  const url = new URL("/signin", getStartFrontendUrl());
  url.searchParams.set("next", normalizedNext);
  return url.toString();
}

export { normalizeNextPath, readNextFromSearchParams };

/**
 * 시작 프론트엔드 루트 URL을 생성합니다.
 *
 * @returns 시작 프론트엔드 루트 절대 URL을 반환합니다.
 */
export function buildStartFrontendRootUrl(): string {
  const url = new URL("/", getStartFrontendUrl());
  return url.toString();
}

/**
 * 인증 관련 API 호출 집합입니다.
 */
export const authApi = {
  me: (): Promise<AuthUser> => api.get<AuthUser>(endpoints.authMe, { withCredentials: true }),
  refresh: async (): Promise<void> => {
    await api.post<unknown>(endpoints.authRefresh, {}, {
      withCredentials: true,
      skipAuthRefresh: true,
    } as AxiosRequestConfig);
  },
  logout: async (): Promise<void> => {
    await api.post(endpoints.authLogout, {});
  },
};
