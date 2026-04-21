/** 백엔드 API 경로 상수를 한곳에서 관리합니다. */
const API_V1 = "/v1";

export const endpoints = {
  documentsBase: `${API_V1}/documents`,
  documents: `${API_V1}/documents`,
  documentsTrash: `${API_V1}/documents/trash`,
  documentById: (id: string) => `${API_V1}/documents/${encodeURIComponent(id)}`,
  documentTransactions: (id: string) => `${API_V1}/editor-operations/documents/${encodeURIComponent(id)}/save`,
  editorOperationMove: `${API_V1}/editor-operations/move`,
  documentRestore: (id: string) => `${API_V1}/documents/${encodeURIComponent(id)}/restore`,
  documentTrash: (id: string) => `${API_V1}/documents/${encodeURIComponent(id)}/trash`,
  documentVisibility: (id: string) => `${API_V1}/documents/${encodeURIComponent(id)}/visibility`,
  documentBlocks: (id: string) => `${API_V1}/documents/${encodeURIComponent(id)}/blocks`,
  adminDocumentBlocks: (documentId: string) => `${API_V1}/admin/documents/${encodeURIComponent(documentId)}/blocks`,
  adminBlockById: (blockId: string) => `${API_V1}/admin/blocks/${encodeURIComponent(blockId)}`,
  adminBlockMove: (blockId: string) => `${API_V1}/admin/blocks/${encodeURIComponent(blockId)}/move`,
  blockById: (id: string) => `${API_V1}/admin/blocks/${encodeURIComponent(id)}`,
  blockMove: (id: string) => `${API_V1}/admin/blocks/${encodeURIComponent(id)}/move`,
  authSsoStart: `${API_V1}/auth/sso/start`,
  authExchange: `${API_V1}/auth/exchange`,
  authRefresh: `${API_V1}/auth/refresh`,
  authMe: `${API_V1}/auth/me`,
  authLogout: `${API_V1}/auth/logout`,
  health: `${API_V1}/health`,
};
