import { documentsApi } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";
import type { HttpError } from "@shared/api/client.types.ts";
import { unwrapApiEnvelope } from "@shared/api/service-contract.ts";
import type {
  ApiEnvelope,
  DocumentResponse,
  DocumentVisibility,
  EditorMoveResponse,
} from "@shared/api/service-contract.ts";
import { generateId } from "@jho951/ui-components";


export type CreatePageBody = {
  parentId: string | null;
  title: string;
};

export type CreatePageResponse = {
  id: DocumentResponse["id"];
  title?: DocumentResponse["title"];
  parentId?: DocumentResponse["parentId"];
  version?: DocumentResponse["version"];
  visibility?: DocumentVisibility;
  icon?: DocumentResponse["icon"];
  cover?: DocumentResponse["cover"];
  sortKey?: DocumentResponse["sortKey"];
  deletedAt?: DocumentResponse["deletedAt"];
};

export type UpdatePageBody = {
  title: string;
  version: number;
  icon?: unknown;
  cover?: unknown;
};

export type UpdatePageVisibilityBody = {
  visibility: DocumentVisibility;
  version: number;
};

export type ListDocumentsItem = Pick<DocumentResponse, "id" | "title" | "parentId" | "sortKey"> & {
  name?: string;
};

type CreateDocumentRequest = {
  parentId: string | null;
  title: string;
};

type UpdateDocumentRequest = {
  title: string;
  version: number;
  icon?: unknown;
  cover?: unknown;
};

function normalizeParentId(parentId: string | null | undefined): string | null | undefined {
  if (parentId === undefined) return undefined;
  if (!parentId) return null;
  if (["my", "pinned", "sharedRoot", "documents", "shared"].includes(parentId)) return null;
  return parentId;
}

type MoveDocumentRequest = {
  targetParentId: string | null;
  afterDocumentId: string | null;
  beforeDocumentId: string | null;
};

type MoveDocumentCompatRequest = {
  resourceType: "DOCUMENT";
  resourceId: string;
  targetParentId: string | null;
  afterId: string | null;
  beforeId: string | null;
};

/**
 * 페이지 생성과 갱신을 처리하는 API 집합입니다.
 */
export const pagesApi = {
  listDocuments: async (): Promise<ListDocumentsItem[]> => {
    const response = await documentsApi.get<ListDocumentsItem[] | ApiEnvelope<ListDocumentsItem[]>>(
      endpoints.documents
    );

    const unwrapped = unwrapApiEnvelope<ListDocumentsItem[]>(response);
    return Array.isArray(unwrapped) ? unwrapped : [];
  },
  getPage: async (id: string): Promise<CreatePageResponse> => {
    const response = await documentsApi.get<ApiEnvelope<DocumentResponse> | DocumentResponse>(
      endpoints.documentById(id)
    );
    return unwrapApiEnvelope(response);
  },
  createPage: async (body: CreatePageBody): Promise<CreatePageResponse> => {
    try {
      const response = await documentsApi.post<ApiEnvelope<DocumentResponse> | DocumentResponse, CreateDocumentRequest>(
        endpoints.documents,
        {
          parentId: normalizeParentId(body.parentId) ?? null,
          title: body.title,
        }
      );

      return unwrapApiEnvelope(response);
    } catch (error) {
      const e = error as HttpError;
      if (typeof e.status === "number" && ![404, 405, 501].includes(e.status)) throw error;

      return {
        id: generateId(),
        title: body.title,
        parentId: body.parentId,
      };
    }
  },
  updatePage: async (id: string, body: UpdatePageBody): Promise<CreatePageResponse> => {
    const response = await documentsApi.patch<ApiEnvelope<DocumentResponse> | DocumentResponse, UpdateDocumentRequest>(
      endpoints.documentById(id),
      {
        title: body.title,
        version: body.version,
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.cover !== undefined ? { cover: body.cover } : {}),
      }
    );

    return unwrapApiEnvelope(response);
  },
  moveToTrash: async (documentId: string): Promise<void> => {
    await documentsApi.patch<unknown, undefined>(endpoints.documentTrash(documentId));
  },
  restoreFromTrash: async (documentId: string): Promise<void> => {
    await documentsApi.post<unknown, undefined>(endpoints.documentRestore(documentId));
  },
  deleteFromTrash: async (documentId: string): Promise<void> => {
    await documentsApi.delete<unknown>(endpoints.documentById(documentId));
  },
  moveDocument: async (
    documentId: string,
    body: MoveDocumentRequest
  ): Promise<CreatePageResponse> => {
    const response = await documentsApi.post<
      ApiEnvelope<EditorMoveResponse | null> | EditorMoveResponse | null,
      MoveDocumentCompatRequest
    >(endpoints.editorOperationMove, {
      resourceType: "DOCUMENT",
      resourceId: documentId,
      targetParentId: body.targetParentId,
      afterId: body.afterDocumentId,
      beforeId: body.beforeDocumentId,
    });

    const unwrapped = unwrapApiEnvelope<EditorMoveResponse | null>(response);
    const moveResponse = unwrapped && typeof unwrapped === "object" ? unwrapped : null;

    return {
      id: moveResponse?.resourceId ?? documentId,
      parentId: moveResponse?.parentId ?? body.targetParentId,
      version: moveResponse?.documentVersion ?? moveResponse?.version,
      sortKey: moveResponse?.sortKey,
    };
  },
  updatePageVisibility: async (
    documentId: string,
    body: UpdatePageVisibilityBody
  ): Promise<CreatePageResponse> => {
    const response = await documentsApi.patch<
      ApiEnvelope<DocumentResponse> | DocumentResponse,
      UpdatePageVisibilityBody
    >(endpoints.documentVisibility(documentId), body);

    return unwrapApiEnvelope(response);
  },
};
