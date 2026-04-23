/**
 * service-contract 기준 공통 API envelope과 문서/에디터 응답 타입입니다.
 */

export type ApiEnvelope<T> = {
  httpStatus?: string | number;
  success?: boolean;
  message?: string;
  code?: number;
  data?: T | null;
  items?: T;
  rows?: T;
};

export type DocumentVisibility = "PUBLIC" | "PRIVATE";

export type DocumentResponse = {
  id: string;
  parentId?: string | null;
  title: string;
  icon?: unknown | null;
  cover?: unknown | null;
  visibility?: DocumentVisibility;
  sortKey?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TrashDocumentResponse = {
  documentId: string;
  title: string;
  parentId?: string | null;
  deletedAt?: string | null;
  purgeAt?: string | null;
};

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strikethrough" }
  | { type: "textColor"; value: string };

export type RichTextContent = {
  format?: "rich_text";
  schemaVersion?: 1;
  blockType?: "paragraph" | "heading1" | "heading2" | "heading3";
  segments?: Array<{
    text?: string;
    marks?: RichTextMark[];
  }>;
};

export type BlockResponse = {
  id: string;
  documentId?: string;
  parentId?: string | null;
  type?: "TEXT";
  content: RichTextContent;
  orderKey?: string | null;
  sortKey?: string | null;
  version: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DocumentTransactionAppliedOperationResponse = {
  opId?: string;
  status?: "APPLIED" | "NO_OP";
  tempId?: string | null;
  blockId?: string | null;
  version?: number | null;
  sortKey?: string | null;
  deletedAt?: string | null;
};

export type DocumentTransactionResponse = {
  documentId?: string;
  documentVersion?: number;
  batchId?: string;
  appliedOperations?: DocumentTransactionAppliedOperationResponse[];
};

export type EditorMoveResponse = {
  resourceType?: "DOCUMENT" | "BLOCK";
  resourceId?: string;
  parentId?: string | null;
  version?: number;
  documentVersion?: number;
  sortKey?: string | null;
};

/**
 * service-contract envelope 또는 과거 호환 payload에서 실제 data를 꺼냅니다.
 */
export function unwrapApiEnvelope<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === "object") {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.data !== undefined) return envelope.data as T;
    if (envelope.items !== undefined) return envelope.items;
    if (envelope.rows !== undefined) return envelope.rows;
  }

  return payload as T;
}
