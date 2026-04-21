/**
 * 에디터 블록, 문서, operation, transaction 관련 타입을 정의합니다.
 */

// Editor supports a small text/block subset for now, but the state shape leaves room for tree editing later.
export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulleted_list"
  | "numbered_list"
  | "to_do"
  | "toggle_list"
  | "code_block";

export type EditorMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strikethrough" }
  | { type: "textColor"; value: string };

export interface EditorContent {
  // Content is stored per block as a full snapshot, not as partial text patches.
  type: EditorBlockType;
  text: string;
  checked?: boolean;
  marks: EditorMark[];
}

export interface EditorBlockState {
  // `parentId` + `orderKey` are enough to rebuild the visible tree without nesting objects.
  id: string;
  parentId: string | null;
  orderKey: string;
  version: number;
  draft: EditorContent;
  lastSynced: EditorContent;
  status: "normal" | "saving" | "conflicted";
  remoteContent?: EditorContent;
  remoteVersion?: number;
}

export interface EditorDocumentState {
  id: string;
  title: string;
  version: number;
  rootBlockId: string;
  replicaId?: string;
  logicalTime?: number;
}

// Operation shape follows the server contract.
// `block.create` only places a block in the tree, and content changes are always sent separately.
export type EditorOperation =
  | {
      type: "block.create";
      blockId: string;
      parentId: string | null;
      afterBlockId?: string | null;
      beforeBlockId?: string | null;
      orderKey?: string;
    }
  | {
      type: "block.replace_content";
      blockId: string;
      version?: number;
      content: EditorContent;
    }
  | {
      type: "block.move";
      blockId: string;
      version?: number;
      parentId: string | null;
      afterBlockId?: string | null;
      beforeBlockId?: string | null;
      orderKey?: string;
    }
  | {
      type: "block.delete";
      blockId: string;
      version?: number;
    };

export interface EditorTransactionRequest {
  clientId: string;
  batchId: string;
  documentVersion: number;
  operations: EditorOperation[];
}

export type GatewayEditorOperationType =
  | "BLOCK_CREATE"
  | "BLOCK_REPLACE_CONTENT"
  | "BLOCK_MOVE"
  | "BLOCK_DELETE";

export interface EditorRichTextContent {
  format: "rich_text";
  schemaVersion: 1;
  segments: Array<{
    text: string;
    marks: EditorMark[];
  }>;
}

export interface GatewayEditorOperation {
  opId: string;
  type: GatewayEditorOperationType;
  blockRef: string;
  version?: number;
  content?: EditorRichTextContent;
  parentRef?: string | null;
  afterRef?: string | null;
  beforeRef?: string | null;
}

export interface GatewayEditorTransactionRequest {
  clientId: string;
  batchId: string;
  operations: GatewayEditorOperation[];
}

export interface EditorTransactionSuccess {
  batchId: string;
  documentVersion?: number;
  idMappings?: Record<string, string>;
  results: Array<{
    blockId: string;
    version: number;
  }>;
}

export interface EditorConflictItem {
  blockId: string;
  serverVersion: number;
  serverContent: EditorContent;
}

export interface EditorConflictResponse {
  batchId: string;
  code: "CONFLICT";
  conflicts: EditorConflictItem[];
}

export interface EditorDocumentSnapshot {
  id: string;
  title: string;
  version?: number;
  rootBlockId?: string;
  replicaId?: string;
  logicalTime?: number;
  // Snapshot stays flat for transport, while the client reconstructs the tree with parentId/orderKey.
  blocks: Array<{
    id: string;
    parentId?: string | null;
    orderKey?: string;
    version: number;
    content: EditorContent;
    deleted?: boolean;
  }>;
}

export interface PendingQueue {
  ops: EditorOperation[];
  byBlockId: Record<string, EditorOperation>;
}

export interface InFlightBatch {
  id: string;
  ops: EditorOperation[];
}
