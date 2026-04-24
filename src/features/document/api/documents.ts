/**
 * 문서 도메인 API를 명세 경로(`/v1/**`) 기준으로 래핑합니다.
 */

import { documentsApi } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";
import { unwrapApiEnvelope } from "@shared/api/service-contract.ts";
import type {
  ApiEnvelope,
  BlockResponse,
  DocumentResponse,
  DocumentTransactionResponse,
  DocumentVisibility,
  EditorMoveResponse,
  TrashDocumentResponse,
} from "@shared/api/service-contract.ts";

type EditorMoveCompatRequest = {
  resourceType: "DOCUMENT";
  resourceId: string;
  targetParentId: string | null;
  afterId: string | null;
  beforeId: string | null;
};

export const documentsDomainApi = {
  getDocuments: async (): Promise<DocumentResponse[]> =>
    unwrapApiEnvelope(await documentsApi.get<ApiEnvelope<DocumentResponse[]>>(endpoints.documents)),
  getTrashDocuments: async (): Promise<TrashDocumentResponse[]> =>
    unwrapApiEnvelope(await documentsApi.get<ApiEnvelope<TrashDocumentResponse[]>>(endpoints.documentsTrash)),
  createDocument: async (
    body: Record<string, unknown>
  ): Promise<DocumentResponse> =>
    unwrapApiEnvelope(await documentsApi.post<ApiEnvelope<DocumentResponse>, Record<string, unknown>>(endpoints.documents, body)),
  getDocument: async (documentId: string): Promise<DocumentResponse> =>
    unwrapApiEnvelope(await documentsApi.get<ApiEnvelope<DocumentResponse>>(endpoints.documentById(documentId))),
  getDocumentBlocks: async (documentId: string): Promise<BlockResponse[]> =>
    unwrapApiEnvelope(await documentsApi.get<ApiEnvelope<BlockResponse[]>>(endpoints.documentBlocks(documentId))),
  updateDocument: async (
    documentId: string,
    body: {
      title: string;
      version: number;
      icon?: unknown;
      cover?: unknown;
    }
  ): Promise<DocumentResponse> =>
    unwrapApiEnvelope(await documentsApi.patch<
      ApiEnvelope<DocumentResponse>,
      {
        title: string;
        version: number;
        icon?: unknown;
        cover?: unknown;
      }
    >(endpoints.documentById(documentId), body)),
  updateDocumentVisibility: async (
    documentId: string,
    body: { visibility: DocumentVisibility; version: number }
  ): Promise<DocumentResponse> =>
    unwrapApiEnvelope(await documentsApi.patch<ApiEnvelope<DocumentResponse>, { visibility: DocumentVisibility; version: number }>(
      endpoints.documentVisibility(documentId),
      body
    )),
  postDocumentTransactions: async (
    documentId: string,
    body: Record<string, unknown>
  ): Promise<DocumentTransactionResponse> =>
    unwrapApiEnvelope(await documentsApi.post<ApiEnvelope<DocumentTransactionResponse>, Record<string, unknown>>(endpoints.documentTransactions(documentId), body)),
  deleteDocument: async (documentId: string): Promise<void> => {
    await documentsApi.delete<unknown>(endpoints.documentById(documentId));
  },
  trashDocument: async (documentId: string): Promise<null | undefined> =>
    unwrapApiEnvelope(await documentsApi.patch<ApiEnvelope<null | undefined>, undefined>(endpoints.documentTrash(documentId))),
  restoreDocument: async (documentId: string): Promise<void> => {
    await documentsApi.post<unknown, undefined>(endpoints.documentRestore(documentId));
  },
  moveDocument: async (
    documentId: string,
    body: {
      targetParentId: string | null;
      afterDocumentId: string | null;
      beforeDocumentId: string | null;
    }
  ): Promise<EditorMoveResponse | null> =>
    unwrapApiEnvelope(await documentsApi.post<ApiEnvelope<EditorMoveResponse | null>, EditorMoveCompatRequest>(endpoints.editorOperationMove, {
      resourceType: "DOCUMENT",
      resourceId: documentId,
      targetParentId: body.targetParentId,
      afterId: body.afterDocumentId,
      beforeId: body.beforeDocumentId,
    })),
  adminCreateBlock: async (
    documentId: string,
    body: Record<string, unknown>
  ): Promise<unknown> =>
    documentsApi.post<unknown, Record<string, unknown>>(endpoints.adminDocumentBlocks(documentId), body),
  adminUpdateBlock: async (
    blockId: string,
    body: Record<string, unknown>
  ): Promise<unknown> =>
    documentsApi.patch<unknown, Record<string, unknown>>(endpoints.adminBlockById(blockId), body),
  adminDeleteBlock: async (blockId: string, body: Record<string, unknown>): Promise<void> => {
    await documentsApi.delete<unknown>(endpoints.adminBlockById(blockId), { data: body });
  },
  adminMoveBlock: async (
    blockId: string,
    body: Record<string, unknown>
  ): Promise<unknown> =>
    documentsApi.post<unknown, Record<string, unknown>>(endpoints.adminBlockMove(blockId), body),
  unwrap: unwrapApiEnvelope,
};
