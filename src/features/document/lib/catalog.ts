/**
 * 문서 카드 목록을 메모리 기반 카탈로그 형태로 관리합니다.
 */

import type { DocCardItem, DocKind } from "@features/document/model/document.types.ts";

/**
 * 문서 카탈로그를 ID 기준으로 보관하는 메모리 저장소입니다.
 */
const catalogStore = new Map<string, DocCardItem>();

/**
 * 초기 문서 목록을 카탈로그 저장소에 채웁니다.
 *
 * @param items 처리할 항목 목록입니다.
 * @returns 반환값이 없습니다.
 */
function seedCatalog(items: DocCardItem[]): void {
  items.forEach((item) => {
    catalogStore.set(item.id, item);
  });
}

/**
 * 현재 메모리 저장소에 있는 전체 문서 카드를 반환합니다.
 *
 * @returns 저장된 모든 문서 카드 배열을 반환합니다.
 */
export function getAllDocs(): DocCardItem[] {
  return [...catalogStore.values()];
}

/**
 * 문서 ID로 카드 정보를 조회합니다.
 *
 * @param id 대상 항목의 ID입니다.
 * @returns 해당 문서 카드 또는 undefined를 반환합니다.
 */
export function findDocById(id: string): DocCardItem | undefined {
  return catalogStore.get(id);
}

/**
 * 특정 종류의 카탈로그를 새 목록으로 교체합니다.
 *
 * @param kind 조회 또는 교체 대상 종류입니다.
 * @param items 처리할 항목 목록입니다.
 * @returns 반환값이 없습니다.
 */
export function replaceCatalog(kind: DocKind, items: DocCardItem[]): void {
  for (const [id, item] of catalogStore.entries()) {
    if (item.kind === kind) {
      catalogStore.delete(id);
    }
  }
  seedCatalog(items);
}

/**
 * 문서 종류에 해당하는 카드 목록만 반환합니다.
 *
 * @param kind 조회 또는 교체 대상 종류입니다.
 * @returns 지정한 종류의 문서 카드 배열을 반환합니다.
 */
export function getCatalogByKind(kind: DocKind): DocCardItem[] {
  return [...catalogStore.values()].filter((item) => item.kind === kind);
}

/**
 * 단일 문서 카드를 추가하거나 기존 항목을 덮어씁니다.
 *
 * @param item 처리할 단일 항목입니다.
 * @returns 반환값이 없습니다.
 */
export function upsertCatalogItem(item: DocCardItem): void {
  catalogStore.set(item.id, item);
}
