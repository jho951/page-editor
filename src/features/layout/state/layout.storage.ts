/**
 * 레이아웃 상태 전용 저장소 읽기 유틸을 제공합니다.
 */

import { LAST } from "@features/layout/constant/constant.ts";
import { safeReadJson } from "@shared/lib/storage.ts";

/**
 * 마지막 위치를 읽습니다.
 * @returns 문자열 결과를 반환합니다.
 */
export function readLastLocation(): { docId: string } | null {
    const value = safeReadJson<unknown>(LAST, null);
    if (!value || typeof value !== "object") return null;
    if (typeof (value as { docId?: unknown }).docId !== "string") return null;
    return { docId: (value as { docId: string }).docId };
}
