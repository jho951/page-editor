/**
 * auth 디렉토리의 공개 export를 재노출합니다.
 */

export { authReducer, bootstrapAuth, logoutAuth } from "@features/auth/state/auth.slice.ts";
export {
  selectAuthError,
  selectAuthInitialized,
  selectAuthStatus,
  selectAuthUser,
  selectIsAuthenticated,
} from "@features/auth/state/auth.selector.ts";
export { AuthGate } from "@features/auth/ui/AuthGate.tsx";
export { AuthRequired } from "@features/auth/ui/AuthRequired.tsx";
export { AuthCallbackView } from "@features/auth/ui/AuthCallbackView.tsx";
export { SignInRedirectView } from "@features/auth/ui/SignInRedirectView.tsx";
export {
  authApi,
  buildPostAuthSuccessUrl,
  buildStartFrontendRootUrl,
  buildSsoStartUrl,
  buildStartFrontendSignInUrl,
  consumePostLoginRedirect,
  exchangeAuthTicket,
  normalizeNextPath,
  readNextFromSearchParams,
  resolveNextPathFromParams,
  storePostLoginRedirect,
} from "@features/auth/api/auth.ts";
export type { AuthUser } from "@features/auth/api/auth.ts";
