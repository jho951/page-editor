/** 브라우저 fetch 기본 credentials를 include로 고정합니다. */
const FETCH_PATCHED_KEY = "__APP_FETCH_CREDENTIALS_INCLUDE_PATCHED__";

export function installGlobalFetchCredentialsInclude(): void {
  if (typeof window === "undefined") return;
  if (typeof window.fetch !== "function") return;

  const state = window as unknown as Record<string, unknown>;
  if (state[FETCH_PATCHED_KEY] === true) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) {
      const request = new Request(input, { ...init, credentials: "include" });
      return originalFetch(request);
    }
    return originalFetch(input, { ...init, credentials: "include" });
  };

  state[FETCH_PATCHED_KEY] = true;
}
