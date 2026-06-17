import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosError,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios';

import { endpoints } from './endpoints.ts';
import type { HttpError } from './client.types.ts';

axios.defaults.withCredentials = true;

/** gateway 요청에 사용할 기본 base URL입니다. */
export const GATEWAY_BASE_URL: string =
    (typeof import.meta !== 'undefined' &&
        (import.meta as unknown as { env?: { VITE_GATEWAY_BASE_URL?: string; VITE_API_BASE_URL?: string } })
            .env?.VITE_GATEWAY_BASE_URL) ||
    (typeof import.meta !== 'undefined' &&
        (import.meta as unknown as { env?: { VITE_GATEWAY_BASE_URL?: string; VITE_API_BASE_URL?: string } })
            .env?.VITE_API_BASE_URL) ||
    'http://localhost:8080';

/** 일반 API 요청에 사용할 기본 base URL입니다. */
export const API_BASE_URL: string = GATEWAY_BASE_URL;

/** 문서 서비스도 현재 gateway의 /v1/documents, /v1/admin 라우트를 통해 호출합니다. */
export const DOCUMENTS_API_BASE_URL: string =
    (typeof import.meta !== 'undefined' &&
        (import.meta as unknown as { env?: { VITE_DOCUMENTS_API_BASE_URL?: string } })
            .env?.VITE_DOCUMENTS_API_BASE_URL) || GATEWAY_BASE_URL;

/** 일반 공통 axios 인스턴스입니다. */
export const http: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

/** 문서 서비스 전용 axios 인스턴스입니다. */
export const documentsHttp: AxiosInstance = axios.create({
    baseURL: DOCUMENTS_API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

type RetryableConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
    skipAuthRefresh?: boolean;
};

function normalizeHttpError(err: unknown): HttpError {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const status = e.response?.status;
    const msg =
        (e.response?.data as { message?: string } | undefined)?.message ||
        e.message ||
        'Request error';

    const norm = new Error(`HTTP ${status ?? ''} ${msg}`.trim()) as HttpError;
    norm.status = status;
    norm.data = e.response?.data;
    return norm;
}

function isAuthFlowRequest(config: RetryableConfig | undefined): boolean {
    if (!config) return false;
    const requestUrl = config.url ?? '';
    return requestUrl.includes(endpoints.authMe) || requestUrl.includes(endpoints.authRefresh);
}

/** 공통 요청 인터셉터를 적용합니다. */
async function applyCookieAuth(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    return config;
}

async function onRejected(_client: AxiosInstance, err: unknown): Promise<AxiosResponse> {
    const error = err as AxiosError;
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // auth 상태 확인 구간과 일반 요청의 401은 호출부에서 anonymous 처리합니다.
    if (status === 401 && isAuthFlowRequest(config)) {
        return Promise.reject(normalizeHttpError(err));
    }

    return Promise.reject(normalizeHttpError(err));
}

/** API 요청은 쿠키 기반 인증만 사용합니다. */
http.interceptors.request.use(applyCookieAuth);
documentsHttp.interceptors.request.use(applyCookieAuth);

/** 공통 응답 에러를 HttpError 형태로 정규화합니다. */
http.interceptors.response.use(
    (res: AxiosResponse) => res,
    (err: unknown) => onRejected(http, err)
);

documentsHttp.interceptors.response.use(
    (res: AxiosResponse) => res,
    (err: unknown) => onRejected(documentsHttp, err)
);

/** 응답 본문만 반환하는 공용 API 래퍼입니다. */
export const api = {
    get: <T = unknown>(url: string, cfg?: AxiosRequestConfig): Promise<T> =>
        http.get<T>(url, { ...cfg, withCredentials: true }).then((r) => r.data),
    post: <T = unknown, B = unknown>(
        url: string,
        body?: B,
        cfg?: AxiosRequestConfig
    ): Promise<T> => http.post<T>(url, body, { ...cfg, withCredentials: true }).then((r) => r.data),
    put: <T = unknown, B = unknown>(
        url: string,
        body?: B,
        cfg?: AxiosRequestConfig
    ): Promise<T> => http.put<T>(url, body, { ...cfg, withCredentials: true }).then((r) => r.data),
    patch: <T = unknown, B = unknown>(
        url: string,
        body?: B,
        cfg?: AxiosRequestConfig
    ): Promise<T> => http.patch<T>(url, body, { ...cfg, withCredentials: true }).then((r) => r.data),
    delete: <T = unknown>(url: string, cfg?: AxiosRequestConfig): Promise<T> =>
        http.delete<T>(url, { ...cfg, withCredentials: true }).then((r) => r.data),
};

/** 문서 서비스용 API 래퍼입니다. */
export const documentsApi = {
    get: <T = unknown>(url: string, cfg?: AxiosRequestConfig): Promise<T> =>
        documentsHttp.get<T>(url, { ...cfg, withCredentials: true }).then((r) => r.data),
    post: <T = unknown, B = unknown>(
        url: string,
        body?: B,
        cfg?: AxiosRequestConfig
    ): Promise<T> => documentsHttp.post<T>(url, body, { ...cfg, withCredentials: true }).then((r) => r.data),
    patch: <T = unknown, B = unknown>(
        url: string,
        body?: B,
        cfg?: AxiosRequestConfig
    ): Promise<T> => documentsHttp.patch<T>(url, body, { ...cfg, withCredentials: true }).then((r) => r.data),
    delete: <T = unknown>(url: string, cfg?: AxiosRequestConfig): Promise<T> =>
        documentsHttp.delete<T>(url, { ...cfg, withCredentials: true }).then((r) => r.data),
};
