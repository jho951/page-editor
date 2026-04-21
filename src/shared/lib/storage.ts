/**
 * 브라우저 저장소에서 안전하게 값을 읽는 공통 유틸을 제공합니다.
 */

/**
 * localStorage JSON 값을 안전하게 읽습니다.
 *
 * @param key 변환 또는 조회에 사용할 키 값입니다.
 * @param fallback fallback 값입니다.
 * @returns 계산된 결과를 반환합니다.
 */
export function safeReadJson<T>(key: string, fallback: T): T {
    try {
        if (typeof window === "undefined") return fallback;

        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * String Array를 읽습니다.
 *
 * @param key 변환 또는 조회에 사용할 키 값입니다.
 * @returns 문자열 배열을 반환합니다.
 */
export function readStringArray(key: string): string[] {
    const value = safeReadJson<unknown>(key, []);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
