/**
 * 현재 로그인 사용자와 인증 상태 초기화 흐름을 관리합니다.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { HttpError } from "@shared/api/client.types.ts";
import { authApi, type AuthUser } from "@features/auth/api/auth.ts";
import type { AuthState, RejectValue } from "@features/auth/state/auth.types.ts";

/**
 * 인증 slice의 초기 상태입니다.
 */
const initialState: AuthState = {
  user: null,
  status: "idle",
  initialized: false,
  error: null,
};

/**
 * 인증 요청 에러를 reject payload 형태로 정규화합니다.
 *
 * @param error 인증 API 호출 중 발생한 예외입니다.
 * @returns 인증 상태 판단에 사용할 reject 값 객체를 반환합니다.
 */
function normalizeAuthError(error: unknown): RejectValue {

  const e = error as HttpError;
  if (e?.status === 401) {
    return { anonymous: true, message: null };
  }
  return { anonymous: false, message: e instanceof Error ? e.message : "auth request failed" };
}

async function loadAuthUser(): Promise<AuthUser> {
  return await authApi.me();
}

/**
 * 현재 로그인 사용자를 초기화하는 thunk입니다.
 */
export const bootstrapAuth = createAsyncThunk<AuthUser, void, { rejectValue: RejectValue }>(
    "auth/bootstrap",
  async (_arg, { rejectWithValue }) => {
    try {
      return await loadAuthUser();
    } catch (error) {
      return rejectWithValue(normalizeAuthError(error));
    }
  }
);

/**
 * 로그아웃을 수행하는 thunk입니다.
 */
export const logoutAuth = createAsyncThunk<void, void, { rejectValue: string }>(
  "auth/logout",
  async (_arg, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : "logout failed");
    }
  }
);

/**
 * 인증 상태와 관련 reducer를 정의하는 slice입니다.
 */
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(bootstrapAuth.pending, (state) => {
      state.status = "loading";
      state.error = null;
    });
    builder.addCase(bootstrapAuth.fulfilled, (state, action) => {
      state.user = action.payload;
      state.status = "authenticated";
      state.initialized = true;
      state.error = null;
    });
    builder.addCase(bootstrapAuth.rejected, (state, action) => {
      state.user = null;
      state.status = action.payload?.anonymous ? "anonymous" : "anonymous";
      state.initialized = true;
      state.error = action.payload?.message ?? null;
    });

    builder.addCase(logoutAuth.fulfilled, (state) => {
      state.user = null;
      state.status = "anonymous";
      state.initialized = true;
      state.error = null;
    });
    builder.addCase(logoutAuth.rejected, (state, action) => {
      state.user = null;
      state.status = "anonymous";
      state.initialized = true;
      state.error = action.payload ?? null;
    });
  },
});

/**
 * 인증 slice reducer입니다.
 */
export const authReducer = authSlice.reducer;
