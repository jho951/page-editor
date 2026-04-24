/**
 * 문서 블록 목록을 카드 미리보기용 축약 텍스트로 변환합니다.
 */

import type { BlockResponse } from "@shared/api/service-contract.ts";
import type { DocCardPreviewBlockType, DocCardPreviewItem } from "@features/document/model/document.types.ts";

const MAX_PREVIEW_ITEMS = 4;

function normalizePreviewBlockType(value: unknown): DocCardPreviewBlockType {
  if (value === "heading1" || value === "heading2" || value === "heading3") {
    return value;
  }

  return "paragraph";
}

function toPreviewText(block: BlockResponse): string {
  const segments = Array.isArray(block.content?.segments) ? block.content.segments : [];

  return segments
    .map((segment) => String(segment?.text ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 활성 블록 배열에서 카드 표시용 미리보기 항목을 만듭니다.
 *
 * @param blocks 문서 블록 배열입니다.
 * @returns 카드 preview 항목 배열을 반환합니다.
 */
export function buildDocumentCardPreview(blocks: BlockResponse[]): DocCardPreviewItem[] {
  return blocks
    .filter((block) => block.deletedAt == null)
    .map((block) => {
      const text = toPreviewText(block);
      if (!text) return null;

      return {
        blockType: normalizePreviewBlockType(block.content?.blockType),
        text,
      } satisfies DocCardPreviewItem;
    })
    .filter((item): item is DocCardPreviewItem => item !== null)
    .slice(0, MAX_PREVIEW_ITEMS);
}
