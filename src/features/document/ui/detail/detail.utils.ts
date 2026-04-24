import type { DocumentDetailState } from "@features/document/ui/detail/detail.types.ts";

function normalizeDocumentTitle(title: string | null | undefined): string {
  const nextTitle = String(title ?? "").trim();
  return nextTitle || "Untitled";
}

function buildDocumentState(
  id: string,
  title: string | null | undefined,
  version: number | null | undefined,
  createdAt?: string,
): DocumentDetailState {
  return {
    createdAt,
    id,
    title: normalizeDocumentTitle(title),
    version: version ?? 0,
  };
}

export { buildDocumentState, normalizeDocumentTitle };
