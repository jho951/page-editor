import { documentsApi } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";
import type { HttpError } from "@shared/api/client.types.ts";
import { generateId } from "@jho951/ui-components";


export type CreatePageBody = {
  parentId: string | null;
  title: string;
};

export type CreatePageResponse = {
  id: string;
  title?: string;
  parentId?: string | null;
  version?: number;
  visibility?: "PUBLIC" | "PRIVATE";
};

export type UpdatePageBody = {
  title: string;
  version: number;
  icon?: unknown;
  cover?: unknown;
};

export type UpdatePageVisibilityBody = {
  visibility: "PUBLIC" | "PRIVATE";
  version: number;
};

export type ListDocumentsItem = {
  id?: string | number;
  title?: string;
  name?: string;
  parentId?: string | number | null;
};

type GlobalResponse<T> = {
  data?: T;
  items?: T;
  rows?: T;
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

function unwrapEnvelope<T>(payload: T | GlobalResponse<T>): T {
  if (payload && typeof payload === "object") {
    const envelope = payload as GlobalResponse<T>;
    if (envelope.data !== undefined) return envelope.data;
    if (envelope.items !== undefined) return envelope.items;
    if (envelope.rows !== undefined) return envelope.rows;
  }
  return payload as T;
}

type MoveDocumentRequest = {
  targetParentId: string | null;
  afterDocumentId: string | null;
  beforeDocumentId: string | null;
};

type MoveDocumentResponse = {
  resourceType?: "DOCUMENT";
  resourceId?: string;
  parentId?: string | null;
  version?: number;
  documentVersion?: number;
  sortKey?: string;
};

/**
 * 페이지 생성과 갱신을 처리하는 API 집합입니다.
 */
export const pagesApi = {
  listDocuments: async (): Promise<ListDocumentsItem[]> => {
    const response = await documentsApi.get<ListDocumentsItem[] | GlobalResponse<ListDocumentsItem[]>>(
      endpoints.documents
    );

    const unwrapped = unwrapEnvelope<ListDocumentsItem[]>(response);
    return Array.isArray(unwrapped) ? unwrapped : [];
  },
  getPage: async (id: string): Promise<CreatePageResponse> => {
    const response = await documentsApi.get<GlobalResponse<CreatePageResponse> | CreatePageResponse>(
      endpoints.documentById(id)
    );
    return unwrapEnvelope(response);
  },
  createPage: async (body: CreatePageBody): Promise<CreatePageResponse> => {
    try {
      const response = await documentsApi.post<GlobalResponse<CreatePageResponse> | CreatePageResponse, CreateDocumentRequest>(
        endpoints.documents,
        {
          parentId: normalizeParentId(body.parentId) ?? null,
          title: body.title,
        }
      );

      return unwrapEnvelope(response);
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
    const response = await documentsApi.patch<GlobalResponse<CreatePageResponse> | CreatePageResponse, UpdateDocumentRequest>(
      endpoints.documentById(id),
      {
        title: body.title,
        version: body.version,
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.cover !== undefined ? { cover: body.cover } : {}),
      }
    );

    return unwrapEnvelope(response);
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
      GlobalResponse<MoveDocumentResponse> | MoveDocumentResponse,
      {
        resourceType: "DOCUMENT";
        resourceId: string;
        targetParentId: string | null;
        afterId: string | null;
        beforeId: string | null;
      }
    >(endpoints.editorOperationMove, {
      resourceType: "DOCUMENT",
      resourceId: documentId,
      targetParentId: body.targetParentId,
      afterId: body.afterDocumentId,
      beforeId: body.beforeDocumentId,
    });

    const unwrapped = unwrapEnvelope(response);
    return {
      id: unwrapped.resourceId ?? documentId,
      parentId: unwrapped.parentId ?? body.targetParentId,
      version: unwrapped.documentVersion ?? unwrapped.version,
    };
  },
  updatePageVisibility: async (
    documentId: string,
    body: UpdatePageVisibilityBody
  ): Promise<CreatePageResponse> => {
    const response = await documentsApi.patch<
      GlobalResponse<CreatePageResponse> | CreatePageResponse,
      UpdatePageVisibilityBody
    >(endpoints.documentVisibility(documentId), body);

    return unwrapEnvelope(response);
  },
};
