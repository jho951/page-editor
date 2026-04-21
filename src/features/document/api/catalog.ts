/**
 * 문서 카탈로그를 조회하고 fallback 데이터를 합성합니다.
 */

import { documentsApi } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";
import type { DocCardItem, DocKind } from "@features/document/model/document.types.ts";
import type { ApiEnvelope, FetchCatalogResult, RemoteCatalogItem } from "@features/document/api/catalog.types.ts";
import { getCatalogByKind, replaceCatalog } from "@features/document/lib/catalog.ts";

/**
 * 원격 문서 카탈로그 조회 기능 활성화 여부입니다.
 */
const REMOTE_DOCS_ENABLED =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: { VITE_ENABLE_REMOTE_DOCS?: string } }).env?.VITE_ENABLE_REMOTE_DOCS === "true";

/**
 * 원격 조회 실패 시 사용할 fallback 문서 목록을 반환합니다.
 *
 * @param kind 조회 또는 교체 대상 종류입니다.
 * @returns 캐시된 카드 목록을 반환합니다. 없으면 빈 배열을 반환합니다.
 */
function fallbackCatalog(kind: DocKind): DocCardItem[] {

  const cached = getCatalogByKind(kind);
  return cached;
}

/**
 * API 응답을 배열 형태로 풀어냅니다.
 *
 * @param payload 처리할 요청 또는 응답 payload입니다.
 * @returns 원격 응답에서 추출한 문서 항목 배열을 반환합니다.
 */
function unwrapList(payload: ApiEnvelope<RemoteCatalogItem[]> | null | undefined): RemoteCatalogItem[] {
  if (!payload || typeof payload !== "object") return [];
  return Array.isArray(payload.data) ? payload.data : [];
}

/**
 * 원격 문서 응답을 카드 UI 모델로 변환합니다.
 *
 * @param item 처리할 단일 항목입니다.
 * @param fallbackKind 원격 응답에 종류 정보가 없을 때 사용할 기본 문서 종류입니다.
 * @returns 카드로 표시할 문서 정보 또는 null을 반환합니다.
 */
function toCardItem(item: RemoteCatalogItem, fallbackKind: DocKind): DocCardItem | null {
  if (item.id == null) return null;

  return {
    id: String(item.id),
    title: String(item.title ?? item.name ?? "Untitled"),
    accent: String(item.accent ?? item.color ?? "#D7D7D7"),
    kind: fallbackKind,
  };
}

/**
 * 카탈로그 종류에 맞는 조회 endpoint를 반환합니다.
 *
 * @param _kind 조회 대상 문서 종류입니다.
 * @returns 문서 목록 조회에 사용할 endpoint 문자열을 반환합니다.
 */
function endpointByKind(_kind: DocKind): string {
  return endpoints.documents;
}

/**
 * 문서 카탈로그를 조회하고 현재 캐시를 최신 목록으로 교체합니다.
 *
 * @param kind 조회 또는 교체 대상 종류입니다.
 * @returns 문서 목록과 데이터 출처를 담은 비동기 결과를 반환합니다.
 */
export async function fetchCatalog(kind: DocKind): Promise<FetchCatalogResult> {
  if (!REMOTE_DOCS_ENABLED) {

    const localItems = fallbackCatalog(kind);
    replaceCatalog(kind, localItems);
    return { items: localItems, source: "local" };
  }

  try {
    const endpoint = endpointByKind(kind);
    const res = await documentsApi.get<ApiEnvelope<RemoteCatalogItem[]>>(endpoint);

    const remoteItems = unwrapList(res)
      .map((item) => toCardItem(item, kind))
      .filter((item): item is DocCardItem => item !== null);

    const items = remoteItems.length > 0 ? remoteItems : fallbackCatalog(kind);
    replaceCatalog(kind, items);
    return { items, source: remoteItems.length > 0 ? "remote" : "local" };
  } catch {

    const localItems = fallbackCatalog(kind);
    replaceCatalog(kind, localItems);
    return { items: localItems, source: "local" };
  }
}
