/**
 * 정규화된 에디터 문서 상태와 저장 큐, 충돌 처리 로직을 관리합니다.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@app/store/store.ts";
import { generateId } from "@jho951/ui-components";
import { editorTransactionsApi } from "@features/editor/api/transactions.ts";
import { buildPendingQueue } from "@features/editor/lib/editorQueue.ts";
import type {
  EditorBlockState,
  EditorConflictResponse,
  EditorContent,
  EditorDocumentState,
  EditorDocumentSnapshot,
  EditorMark,
  EditorOperation,
  EditorTransactionRequest,
  InFlightBatch,
  PendingQueue
} from "@features/editor/model/editor.types.ts";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

interface EditorDocumentsState {
  currentDocumentId: string | null;
  byId: Record<string, EditorDocumentState>;
}

interface EditorBlocksState {
  byId: Record<string, EditorBlockState>;
  childrenByParentId: Record<string, string[]>;
}

interface EditorState {
  document: EditorDocumentsState;
  blocks: EditorBlocksState;
  selectedBlockId: string | null;
  queue: PendingQueue;
  inFlight: InFlightBatch | null;
  saveState: SaveState;
  lastSavedAt: number | null;
  errorMessage: string | null;
  autosaveScheduledAt: number | null;
  loaded: boolean;
}

/**
 * 에디터 slice의 초기 상태입니다.
 */
const initialState: EditorState = {
  document: {
    currentDocumentId: null,
    byId: {},
  },
  blocks: {
    byId: {},
    childrenByParentId: {},
  },
  selectedBlockId: null,
  queue: { ops: [], byBlockId: {} },
  inFlight: null,
  saveState: "idle",
  lastSavedAt: null,
  errorMessage: null,
  autosaveScheduledAt: null,
  loaded: false,
};

// Server snapshots arrive as a flat block list. The client expands that into document metadata + tree indexes.

/**
 * 서버 스냅샷을 정규화된 에디터 상태로 변환합니다.
 *
 * @param snapshot 서버에서 받은 문서 스냅샷입니다.
 * @returns 문서 메타데이터, 블록 인덱스, 초기 선택 상태를 포함한 에디터 초기화 결과를 반환합니다.
 */
function snapshotToState(snapshot: EditorDocumentSnapshot): Pick<
  EditorState,
  "document" | "blocks" | "selectedBlockId" | "queue" | "inFlight" | "saveState" | "errorMessage" | "loaded"
> {

  const rootBlockId = snapshot.rootBlockId ?? `root-${snapshot.id}`;
  // Deleted blocks stay in snapshot history for sync purposes, but the editor only hydrates visible blocks.

  const activeBlocks = snapshot.blocks.filter((block) => !block.deleted);
  const shouldSeedInitialBlock = activeBlocks.length === 0;
  const initialBlockId = shouldSeedInitialBlock ? `tmp:block:${generateId()}` : null;

  const sortedBlocks = [...activeBlocks].sort((a, b) => {

    const parentOrder = (a.parentId ?? rootBlockId).localeCompare(b.parentId ?? rootBlockId);
    if (parentOrder !== 0) return parentOrder;
    return (a.orderKey ?? "").localeCompare(b.orderKey ?? "");
  });

  const blockMap = Object.fromEntries(
    sortedBlocks.map((block, index) => [
      block.id,
      {
        id: block.id,
        parentId: block.parentId ?? rootBlockId,
        orderKey: block.orderKey ?? createOrderKey(index),
        version: block.version,
        draft: { ...block.content },
        lastSynced: { ...block.content },
        status: "normal" as const,
      },
    ])
  );

  const childrenByParentId = sortedBlocks.reduce<Record<string, string[]>>((acc, block) => {

    const parentId = block.parentId ?? rootBlockId;

    const bucket = acc[parentId] ?? [];
    bucket.push(block.id);
    acc[parentId] = bucket;
    return acc;
  }, {});
  childrenByParentId[rootBlockId] ??= [];

  const documentVersion = activeBlocks.reduce((max, block) => Math.max(max, block.version), 0);
  if (shouldSeedInitialBlock && initialBlockId) {
    childrenByParentId[rootBlockId] = [initialBlockId];
  }

  const initialBlock: Record<string, EditorBlockState> = shouldSeedInitialBlock && initialBlockId
    ? {
        [initialBlockId]: {
          id: initialBlockId,
          parentId: rootBlockId,
          orderKey: createOrderKey(0),
          version: 0,
          draft: { type: "paragraph", text: "", checked: false, marks: [] },
          lastSynced: { type: "paragraph", text: "", checked: false, marks: [] },
          status: "normal" as const,
        },
      }
    : {};

  return {
    document: {
      currentDocumentId: snapshot.id,
      byId: {
        [snapshot.id]: {
          id: snapshot.id,
          title: snapshot.title,
          version: snapshot.version ?? documentVersion,
          rootBlockId,
          replicaId: snapshot.replicaId,
          logicalTime: snapshot.logicalTime ?? snapshot.version ?? documentVersion,
        },
      },
    },
    blocks: {
      byId: {
        [rootBlockId]: {
          id: rootBlockId,
          parentId: null,
          orderKey: "root",
          version: documentVersion,
          draft: { type: "paragraph", text: "", checked: false, marks: [] },
          lastSynced: { type: "paragraph", text: "", checked: false, marks: [] },
          status: "normal",
        },
        ...blockMap,
        ...initialBlock,
      },
      childrenByParentId,
    },
    selectedBlockId: childrenByParentId[rootBlockId]?.[0] ?? null,
    queue: shouldSeedInitialBlock && initialBlockId
      ? buildPendingQueue([
          {
            type: "block.create",
            blockId: initialBlockId,
            parentId: rootBlockId,
            afterBlockId: null,
            beforeBlockId: null,
            orderKey: createOrderKey(0),
          },
        ])
      : { ops: [], byBlockId: {} },
    inFlight: null,
    saveState: shouldSeedInitialBlock ? "dirty" : "idle",
    errorMessage: null,
    loaded: true,
  };
}

/**
 * 현재 열려 있는 문서 ID를 반환합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 현재 문서 ID 또는 null을 반환합니다.
 */
function currentDocumentId(state: EditorState): string | null {
  return state.document.currentDocumentId;
}

/**
 * 현재 열려 있는 문서 메타데이터를 반환합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 현재 문서 메타데이터 또는 null을 반환합니다.
 */
function currentDocument(state: EditorState): EditorDocumentState | null {

  const id = currentDocumentId(state);
  return id ? state.document.byId[id] ?? null : null;
}

// Most current editor actions still work on one visible sibling list at a time.

/**
 * 현재 선택 블록과 같은 형제 목록 순서를 반환합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 현재 편집 컨텍스트에서 표시 중인 형제 블록 ID 배열을 반환합니다.
 */
function currentBlockOrder(state: EditorState): string[] {

  const block = selectedBlock(state);
  if (block?.parentId) {
    return state.blocks.childrenByParentId[block.parentId] ?? [];
  }

  const doc = currentDocument(state);
  if (!doc) return [];
  return state.blocks.childrenByParentId[doc.rootBlockId] ?? [];
}

/**
 * 현재 형제 블록 순서를 상태에 반영합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param parentId 기준이 되는 부모 블록 또는 폴더 ID입니다.
 * @param nextOrder 반영할 형제 블록 순서 목록입니다.
 * @returns 반환값이 없습니다.
 */
function setCurrentBlockOrder(state: EditorState, parentId: string, nextOrder: string[]): void {
  updateSiblingOrderMetadata(state, parentId, nextOrder);
}

/**
 * 형제 순서를 저장할 orderKey 문자열을 생성합니다.
 *
 * @param index 형제 목록 안에서 사용할 순번입니다.
 * @returns 정렬 가능한 orderKey 문자열을 반환합니다.
 */
function createOrderKey(index: number): string {
  return `ord:${String(index).padStart(6, "0")}`;
}

/**
 * 형제 목록 순서에 맞춰 parentId와 orderKey를 갱신합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param parentId 기준이 되는 부모 블록 또는 폴더 ID입니다.
 * @param orderedIds 정렬 기준이 되는 형제 블록 ID 목록입니다.
 * @returns 반환값이 없습니다.
 */
function updateSiblingOrderMetadata(state: EditorState, parentId: string, orderedIds: string[]): void {
  // orderKey is recalculated from the visible sibling order so local tree state stays deterministic.
  state.blocks.childrenByParentId[parentId] = orderedIds;
  orderedIds.forEach((blockId, index) => {

    const block = state.blocks.byId[blockId];
    if (!block) return;
    block.parentId = parentId;
    block.orderKey = createOrderKey(index);
  });
}

/**
 * 문서 레벨 version과 logicalTime을 증가시킵니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 반환값이 없습니다.
 */
function touchCurrentDocument(state: EditorState): void {
  // Document-level version/logical time gives us one place to hang future sync metadata.

  const doc = currentDocument(state);
  if (!doc) return;
  doc.version += 1;
  doc.logicalTime = (doc.logicalTime ?? 0) + 1;
}

/**
 * 새 operation을 저장 큐에 추가합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param op 처리할 operation 객체입니다.
 * @returns 반환값이 없습니다.
 */
function enqueue(state: EditorState, op: EditorOperation): void {
  // Every local change goes through the queue so autosave, retry, and conflict handling share one path.
  state.queue = buildPendingQueue([...state.queue.ops, op]);
  touchCurrentDocument(state);
  if (state.saveState !== "saving") {
    state.saveState = "dirty";
  }
}

/**
 * 현재 선택된 블록 객체를 반환합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 선택된 블록 또는 null을 반환합니다.
 */
function selectedBlock(state: EditorState): EditorBlockState | null {

  const id = state.selectedBlockId;
  if (!id) return null;
  return state.blocks.byId[id] ?? null;
}

// New blocks are inserted next to the currently selected block, or under the document root if nothing is selected.

/**
 * 새 블록이 들어갈 기본 부모 ID를 계산합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @returns 선택 블록의 부모 ID 또는 문서 루트 ID를 반환합니다.
 */
function selectedParentId(state: EditorState): string | null {

  const block = selectedBlock(state);
  if (block) return block.parentId;

  const doc = currentDocument(state);
  return doc?.rootBlockId ?? null;
}

/**
 * 현재 블록 기준의 앞뒤 형제 ID를 계산합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param parentId 기준이 되는 부모 블록 또는 폴더 ID입니다.
 * @param blockId 대상 블록 ID입니다.
 * @returns 이동 기준으로 사용할 앞뒤 형제 블록 ID를 반환합니다.
 */
function siblingContext(state: EditorState, parentId: string, blockId: string) {

  const siblings = state.blocks.childrenByParentId[parentId] ?? [];

  const index = siblings.indexOf(blockId);

  // The server resolves placement from adjacent siblings instead of trusting a client-only index.
  return {
    afterBlockId: index > 0 ? siblings[index - 1] : null,
    beforeBlockId: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

/**
 * 특정 블록을 루트로 하는 subtree의 블록 ID를 수집합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param rootId 기준이 되는 루트 블록 ID입니다.
 * @returns 하위 트리에 포함된 블록 ID 배열을 반환합니다.
 */
function collectSubtreeIds(state: EditorState, rootId: string): string[] {

  const collected = [rootId];

  // Breadth-first collection keeps subtree deletion predictable even after nested blocks are introduced.
  for (let index = 0; index < collected.length; index += 1) {

    const childIds = state.blocks.childrenByParentId[collected[index]] ?? [];
    collected.push(...childIds);
  }

  return collected;
}

/**
 * subtree 전체를 클라이언트 상태에서 제거합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param rootId 기준이 되는 루트 블록 ID입니다.
 * @returns 반환값이 없습니다.
 */
function removeSubtreeFromState(state: EditorState, rootId: string): void {

  const subtreeIds = collectSubtreeIds(state, rootId);

  // Delete semantics are subtree-based, so local state mirrors the same rule before sync.
  subtreeIds.forEach((blockId) => {
    delete state.blocks.byId[blockId];
    delete state.blocks.childrenByParentId[blockId];
  });
}

/**
 * 블록 draft를 갱신하고 replace_content operation을 큐에 추가합니다.
 *
 * @param state 현재 Redux 상태입니다.
 * @param blockId 대상 블록 ID입니다.
 * @param content 블록에 반영할 본문 내용입니다.
 * @returns 반환값이 없습니다.
 */
function markBlockDirty(state: EditorState, blockId: string, content: EditorContent): void {

  const block = state.blocks.byId[blockId];
  if (!block) return;
  // Draft is updated immediately for UX, and the persisted version is reconciled through the queue.
  block.draft = content;
  if (block.status !== "conflicted") {
    block.status = "normal";
  }
  enqueue(state, {
    type: "block.replace_content",
    blockId,
    version: block.id.startsWith("tmp:block:") ? undefined : block.version,
    content,
  });
}

function remapOperationId(op: EditorOperation, idMappings: Record<string, string>): EditorOperation {
  const mapId = (id: string | null | undefined): string | null | undefined => {
    if (typeof id !== "string") return id;
    return idMappings[id] ?? id;
  };

  if (op.type === "block.create") {
    return {
      ...op,
      blockId: mapId(op.blockId) ?? op.blockId,
      parentId: mapId(op.parentId) ?? null,
      afterBlockId: mapId(op.afterBlockId),
      beforeBlockId: mapId(op.beforeBlockId),
    };
  }

  if (op.type === "block.move") {
    return {
      ...op,
      blockId: mapId(op.blockId) ?? op.blockId,
      parentId: mapId(op.parentId) ?? null,
      afterBlockId: mapId(op.afterBlockId),
      beforeBlockId: mapId(op.beforeBlockId),
    };
  }

  return {
    ...op,
    blockId: mapId(op.blockId) ?? op.blockId,
  };
}

function applyBlockIdMappings(state: EditorState, idMappings: Record<string, string>): void {
  const entries = Object.entries(idMappings);
  if (entries.length === 0) return;

  const nextById: Record<string, EditorBlockState> = {};
  Object.values(state.blocks.byId).forEach((block) => {
    const nextId = idMappings[block.id] ?? block.id;
    const nextParentId = block.parentId ? (idMappings[block.parentId] ?? block.parentId) : null;
    nextById[nextId] = {
      ...block,
      id: nextId,
      parentId: nextParentId,
    };
  });
  state.blocks.byId = nextById;

  const nextChildrenByParentId: Record<string, string[]> = {};
  Object.entries(state.blocks.childrenByParentId).forEach(([parentId, childIds]) => {
    const nextParentId = idMappings[parentId] ?? parentId;
    nextChildrenByParentId[nextParentId] = childIds.map((childId) => idMappings[childId] ?? childId);
  });
  state.blocks.childrenByParentId = nextChildrenByParentId;

  if (state.selectedBlockId) {
    state.selectedBlockId = idMappings[state.selectedBlockId] ?? state.selectedBlockId;
  }

  state.queue = buildPendingQueue(state.queue.ops.map((op) => remapOperationId(op, idMappings)));
}

function transactionVersion(blockId: string, version: number): number | undefined {
  return blockId.startsWith("tmp:block:") ? undefined : version;
}

function resolveParentBlockRef(state: EditorState, parentId: string | null | undefined): string | null {
  if (parentId) return parentId;
  return state.document.currentDocumentId ? state.document.byId[state.document.currentDocumentId]?.rootBlockId ?? null : null;
}

function siblingContextForBlock(state: EditorState, parentId: string | null, blockId: string) {
  if (!parentId) {
    return { afterBlockId: null, beforeBlockId: null };
  }
  return siblingContext(state, parentId, blockId);
}

export function prepareEditorTransactionOperations(
  state: Pick<EditorState, "document" | "blocks">,
  ops: EditorOperation[]
): EditorOperation[] {
  const prepared: EditorOperation[] = [];
  const createdTempIds = new Set<string>();

  const appendSyntheticCreate = (blockId: string): void => {
    if (createdTempIds.has(blockId)) return;

    const block = state.blocks.byId[blockId];
    if (!block) return;

    const parentId = resolveParentBlockRef(
      state as EditorState,
      block.parentId
    );
    const { afterBlockId, beforeBlockId } = siblingContextForBlock(state as EditorState, parentId, blockId);

    prepared.push({
      type: "block.create",
      blockId: block.id,
      parentId,
      afterBlockId,
      beforeBlockId,
      orderKey: block.orderKey,
    });
    createdTempIds.add(blockId);
  };

  for (const op of ops) {
    if (op.type === "block.create") {
      prepared.push(op);
      if (op.blockId.startsWith("tmp:block:")) {
        createdTempIds.add(op.blockId);
      }
      continue;
    }

    if (op.blockId.startsWith("tmp:block:") && !createdTempIds.has(op.blockId)) {
      appendSyntheticCreate(op.blockId);
    }

    prepared.push(op);
  }

  return prepared;
}

function toggleMark(marks: EditorMark[], nextType: Exclude<EditorMark["type"], "textColor">): EditorMark[] {
  const hasMark = marks.some((mark) => mark.type === nextType);
  if (hasMark) {
    return marks.filter((mark) => mark.type !== nextType);
  }
  return [...marks, { type: nextType }];
}

function setTextColorMark(marks: EditorMark[], value: string | null): EditorMark[] {
  const nextMarks = marks.filter((mark) => mark.type !== "textColor");
  if (!value) return nextMarks;
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return marks;
  return [...nextMarks, { type: "textColor", value: value.toUpperCase() }];
}

/**
 * 문서 스냅샷을 불러오는 thunk입니다.
 */
export const loadEditorDocument = createAsyncThunk(
  "editor/loadDocument",
  async (documentId: string) => editorTransactionsApi.loadDocument(documentId)
);

/**
 * 대기 중인 에디터 operation을 서버로 전송하는 thunk입니다.
 */
export const flushEditorTransactions = createAsyncThunk<
  { batchId: string; response: Awaited<ReturnType<typeof editorTransactionsApi.postTransactions>> },
  { force?: boolean } | undefined,
  { state: RootState; rejectValue: EditorConflictResponse | { message: string; status?: number } }
>("editor/flush", async (_arg, { getState, rejectWithValue, requestId }) => {

  const state = getState().editor;

  const documentId = state.document.currentDocumentId;
  const inFlightBatch = state.inFlight?.id === requestId ? state.inFlight : null;
  const ops = prepareEditorTransactionOperations(state, inFlightBatch?.ops ?? state.queue.ops);

  if (!documentId) {
    console.log("[EDITOR][flush-skip]", {
      documentId,
      inFlight: state.inFlight,
      queueLength: ops.length,
      force: Boolean(_arg?.force),
    });
    return rejectWithValue({ message: "no-op" });
  }

  const force = Boolean(_arg?.force);
  if (!force && ops.length === 0) {
    console.log("[EDITOR][flush-noop]", {
      documentId,
      inFlight: state.inFlight,
      queueLength: ops.length,
      force,
    });
    return rejectWithValue({ message: "no-op" });
  }

  const batchId = requestId;
  const payload: EditorTransactionRequest = {
    clientId: "web-editor",
    batchId,
    documentVersion: state.document.byId[documentId]?.version ?? 0,
    operations: ops,
  };

  console.log("[EDITOR][flush-request]", {
    documentId,
    batchId,
    force,
    queueLength: payload.operations.length,
    documentVersion: payload.documentVersion,
  });

  try {

    const response = await editorTransactionsApi.postTransactions(documentId, payload);
    console.log("[EDITOR][flush-success]", {
      documentId,
      batchId,
      response,
    });
    return { batchId, response };
  } catch (error) {

    const e = error as { status?: number; data?: unknown; message?: string };
    if (e.status === 409 && e.data) {
      if (
        typeof e.data === "object" &&
        e.data !== null &&
        "code" in (e.data as Record<string, unknown>) &&
        (e.data as { code?: string }).code === "CONFLICT"
      ) {
        console.log("[EDITOR][flush-conflict-local]", {
          documentId,
          batchId,
          status: e.status,
          data: e.data,
        });
        return rejectWithValue(e.data as EditorConflictResponse);
      }

      console.log("[EDITOR][flush-conflict]", {
        documentId,
        batchId,
        status: e.status,
        data: e.data,
      });
      return rejectWithValue({ message: "save conflict", status: 409 });
    }
    if (e.status === 409) {
      console.log("[EDITOR][flush-conflict]", {
        documentId,
        batchId,
        status: e.status,
        data: e.data,
      });
      return rejectWithValue({ message: "save conflict", status: 409 });
    }
    console.log("[EDITOR][flush-error]", {
      documentId,
      batchId,
      status: e.status,
      message: e.message,
    });
    return rejectWithValue({ message: e.message ?? "save failed" });
  }
});

/**
 * 에디터 상태와 관련 reducer를 정의하는 slice입니다.
 */
const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    setSelectedBlock(state, action: PayloadAction<string | null>) {
      state.selectedBlockId = action.payload;
    },
    updateBlockText(state, action: PayloadAction<{ blockId: string; text: string }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = { ...block.draft, text: action.payload.text };
      markBlockDirty(state, action.payload.blockId, next);
    },
    toggleBlockMark(state, action: PayloadAction<{ blockId: string; markType: "bold" | "italic" | "underline" | "strikethrough" }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        marks: toggleMark(block.draft.marks, action.payload.markType),
      };
      markBlockDirty(state, action.payload.blockId, next);
    },
    setBlockTextColor(state, action: PayloadAction<{ blockId: string; value: string | null }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        marks: setTextColorMark(block.draft.marks, action.payload.value),
      };
      markBlockDirty(state, action.payload.blockId, next);
    },
    setBlockType(state, action: PayloadAction<{ blockId: string; type: EditorContent["type"] }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        type: action.payload.type,
        checked: action.payload.type === "to_do" ? Boolean(block.draft.checked) : false,
      };
      markBlockDirty(state, action.payload.blockId, next);
    },
    toggleTodoChecked(state, action: PayloadAction<{ blockId: string }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;
      if (block.draft.type !== "to_do") return;

      const next = { ...block.draft, checked: !block.draft.checked };
      markBlockDirty(state, action.payload.blockId, next);
    },
    insertBlockAfter(state, action: PayloadAction<{ afterBlockId: string | null }>) {

      const id = `tmp:block:${generateId()}`;

      const parentId = selectedParentId(state);
      const block: EditorBlockState = {
        id,
        parentId,
        orderKey: createOrderKey(0),
        version: 0,
        draft: { type: "paragraph", text: "", checked: false, marks: [] },
        lastSynced: { type: "paragraph", text: "", checked: false, marks: [] },
        status: "normal",
      };

      state.blocks.byId[id] = block;

      const order = currentBlockOrder(state);

      const afterIndex = action.payload.afterBlockId
        ? order.indexOf(action.payload.afterBlockId)
        : -1;

      const insertAt = afterIndex >= 0 ? afterIndex + 1 : order.length;

      const nextOrder = [...order];
      nextOrder.splice(insertAt, 0, id);
      if (parentId) {
        setCurrentBlockOrder(state, parentId, nextOrder);
      }
      state.selectedBlockId = id;

      const { afterBlockId, beforeBlockId } = parentId
        ? siblingContext(state, parentId, id)
        : { afterBlockId: null, beforeBlockId: null };

      // Create only introduces the block into the tree. Blank content stays implicit until replaced.
      enqueue(state, {
        type: "block.create",
        blockId: id,
        parentId: block.parentId,
        afterBlockId,
        beforeBlockId,
        orderKey: block.orderKey,
      });
    },
    duplicateSelectedBlock(state) {

      const current = selectedBlock(state);
      if (!current) return;

      const order = currentBlockOrder(state);

      const currentIndex = order.indexOf(current.id);

      const nextId = `tmp:block:${generateId()}`;

      state.blocks.byId[nextId] = {
        id: nextId,
        parentId: current.parentId,
        orderKey: createOrderKey(0),
        version: 0,
        draft: { ...current.draft },
        lastSynced: { ...current.draft },
        status: "normal",
      };

      const nextOrder = [...order];
      nextOrder.splice(currentIndex + 1, 0, nextId);
      if (current.parentId) {
        setCurrentBlockOrder(state, current.parentId, nextOrder);
      }
      state.selectedBlockId = nextId;

      const { afterBlockId, beforeBlockId } = current.parentId
        ? siblingContext(state, current.parentId, nextId)
        : { afterBlockId: null, beforeBlockId: null };

      // Duplication preserves placement and content as two separate operations to match the backend contract.
      enqueue(state, {
        type: "block.create",
        blockId: nextId,
        parentId: state.blocks.byId[nextId].parentId,
        afterBlockId,
        beforeBlockId,
        orderKey: state.blocks.byId[nextId].orderKey,
      });
      // The server contract splits placement and content, so duplication is create + replace_content.
      enqueue(state, {
        type: "block.replace_content",
        blockId: nextId,
        version: transactionVersion(nextId, state.blocks.byId[nextId].version),
        content: { ...current.draft },
      });
    },
    deleteSelectedBlock(state) {

      const current = selectedBlock(state);
      if (!current) return;

      const nextOrder = currentBlockOrder(state).filter((blockId) => blockId !== current.id);
      if (current.parentId) {
        setCurrentBlockOrder(state, current.parentId, nextOrder);
      }
      removeSubtreeFromState(state, current.id);
      state.selectedBlockId = nextOrder[0] ?? null;

      enqueue(state, {
        type: "block.delete",
        blockId: current.id,
        version: transactionVersion(current.id, current.version),
      });
    },
    moveSelectedBlock(state, action: PayloadAction<"up" | "down">) {

      const current = selectedBlock(state);
      if (!current) return;

      const order = currentBlockOrder(state);

      const currentIndex = order.indexOf(current.id);
      if (currentIndex < 0) return;

      const nextIndex = action.payload === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= order.length) return;

      const nextOrder = [...order];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, moved);
      if (current.parentId) {
        setCurrentBlockOrder(state, current.parentId, nextOrder);
      }

      const { afterBlockId, beforeBlockId } = current.parentId
        ? siblingContext(state, current.parentId, current.id)
        : { afterBlockId: null, beforeBlockId: null };

      // Move carries adjacency info so the server can resolve the final position without a client index.
      enqueue(state, {
        type: "block.move",
        blockId: current.id,
        version: transactionVersion(current.id, current.version),
        parentId: current.parentId,
        afterBlockId,
        beforeBlockId,
        orderKey: current.orderKey,
      });
    },
    setAutosaveScheduledAt(state, action: PayloadAction<number | null>) {
      state.autosaveScheduledAt = action.payload;
    },
    consumeConflict(state, action: PayloadAction<{ blockId: string; useRemote: boolean }>) {

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;
      if (typeof block.remoteVersion === "number" && block.remoteContent) {
        if (action.payload.useRemote) {
          block.draft = { ...block.remoteContent };
          block.lastSynced = { ...block.remoteContent };
          block.version = block.remoteVersion;
        } else {
          // Keeping local content means re-enqueueing a full replace against the fresh server version.
          block.lastSynced = { ...block.remoteContent };
          block.version = block.remoteVersion;
          enqueue(state, {
            type: "block.replace_content",
            blockId: block.id,
            version: block.remoteVersion,
            content: { ...block.draft },
          });
        }
      }
      block.status = "normal";
      block.remoteContent = undefined;
      block.remoteVersion = undefined;
      state.saveState = state.queue.ops.length > 0 ? "dirty" : "idle";
    },
    requeueInFlight(state) {
      if (!state.inFlight) return;
      state.queue = buildPendingQueue([...state.inFlight.ops, ...state.queue.ops]);
      state.inFlight.ops.forEach((op) => {

        const block = state.blocks.byId[op.blockId];
        if (block?.status === "saving") {
          block.status = "normal";
        }
      });
      state.inFlight = null;
      state.saveState = state.queue.ops.length > 0 ? "dirty" : "idle";
    },
    clearEditorError(state) {
      state.errorMessage = null;
      if (state.saveState === "error") {
        state.saveState = state.queue.ops.length > 0 ? "dirty" : "idle";
      }
    },
    consumeShortcutCommand(state, action: PayloadAction<{ command: string }>) {

      const block = selectedBlock(state);
      if (!block) return;

      switch (action.payload.command) {
        case "turn-into-text":
          markBlockDirty(state, block.id, { ...block.draft, type: "paragraph", checked: false });
          break;
        case "turn-into-heading-1":
          markBlockDirty(state, block.id, { ...block.draft, type: "heading1", checked: false });
          break;
        case "turn-into-heading-2":
          markBlockDirty(state, block.id, { ...block.draft, type: "heading2", checked: false });
          break;
        case "turn-into-heading-3":
          markBlockDirty(state, block.id, { ...block.draft, type: "heading3", checked: false });
          break;
        case "turn-into-bulleted-list":
          markBlockDirty(state, block.id, { ...block.draft, type: "bulleted_list", checked: false });
          break;
        case "turn-into-numbered-list":
          markBlockDirty(state, block.id, { ...block.draft, type: "numbered_list", checked: false });
          break;
        case "turn-into-to-do":
          markBlockDirty(state, block.id, { ...block.draft, type: "to_do", checked: Boolean(block.draft.checked) });
          break;
        case "turn-into-toggle-list":
          markBlockDirty(state, block.id, { ...block.draft, type: "toggle_list", checked: false });
          break;
        case "turn-into-code-block":
          markBlockDirty(state, block.id, { ...block.draft, type: "code_block", checked: false });
          break;
        case "format-bold":
          editorSlice.caseReducers.toggleBlockMark(state, { type: action.type, payload: { blockId: block.id, markType: "bold" } });
          break;
        case "format-italic":
          editorSlice.caseReducers.toggleBlockMark(state, { type: action.type, payload: { blockId: block.id, markType: "italic" } });
          break;
        case "format-underline":
          editorSlice.caseReducers.toggleBlockMark(state, { type: action.type, payload: { blockId: block.id, markType: "underline" } });
          break;
        case "format-strikethrough":
          editorSlice.caseReducers.toggleBlockMark(state, { type: action.type, payload: { blockId: block.id, markType: "strikethrough" } });
          break;
        case "duplicate-block":
          editorSlice.caseReducers.duplicateSelectedBlock(state);
          break;
        case "move-block-up":
          editorSlice.caseReducers.moveSelectedBlock(state, { type: action.type, payload: "up" });
          break;
        case "move-block-down":
          editorSlice.caseReducers.moveSelectedBlock(state, { type: action.type, payload: "down" });
          break;
        default:
          break;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadEditorDocument.fulfilled, (state, action) => {
      Object.assign(state, snapshotToState(action.payload));
      state.lastSavedAt = null;
    });

    builder.addCase(flushEditorTransactions.pending, (state, action) => {
      const force = Boolean(action.meta.arg?.force);
      if (state.inFlight || (!force && state.queue.ops.length === 0)) return;
      // Pending queue is moved into inFlight so new local edits can keep accumulating independently.
      state.inFlight = {
        id: action.meta.requestId,
        ops: state.queue.ops,
      };
      state.queue = { ops: [], byBlockId: {} };
      state.saveState = "saving";
      state.errorMessage = null;
      state.inFlight.ops.forEach((op) => {

        const block = state.blocks.byId[op.blockId];
        if (block) block.status = "saving";
      });
    });

    builder.addCase(flushEditorTransactions.fulfilled, (state, action) => {
      if (!state.inFlight) return;
      if (state.inFlight.id !== action.meta.requestId) return;
      if (action.payload.batchId !== state.inFlight.id) return;

      applyBlockIdMappings(state, action.payload.response.idMappings ?? {});

      // Successful blocks advance to the server-confirmed version and clear any stale conflict markers.
      action.payload.response.results.forEach((result) => {

        const block = state.blocks.byId[result.blockId];
        if (!block) return;
        block.version = result.version;
        block.lastSynced = { ...block.draft };
        block.status = "normal";
        block.remoteContent = undefined;
        block.remoteVersion = undefined;
      });

      const doc = currentDocument(state);
      if (doc && typeof action.payload.response.documentVersion === "number") {
        doc.version = action.payload.response.documentVersion;
      }

      state.inFlight = null;
      state.saveState = state.queue.ops.length > 0 ? "dirty" : "saved";
      state.lastSavedAt = Date.now();
    });

    builder.addCase(flushEditorTransactions.rejected, (state, action) => {
      if (!state.inFlight || state.inFlight.id !== action.meta.requestId) return;

      const inFlightOps = state.inFlight.ops;

      if (action.payload && "code" in action.payload) {
        // Conflict responses carry authoritative server content per block for user resolution.

        const conflictPayload = action.payload as EditorConflictResponse;
        if (conflictPayload.batchId !== state.inFlight.id) return;

        const conflicts = new Map(conflictPayload.conflicts.map((item) => [item.blockId, item]));

        inFlightOps.forEach((op) => {

          const block = state.blocks.byId[op.blockId];
          if (!block) return;

          const conflict = conflicts.get(op.blockId);
          if (conflict) {
            block.status = "conflicted";
            block.remoteContent = { ...conflict.serverContent };
            block.remoteVersion = conflict.serverVersion;
          } else {
            block.status = "normal";
          }
        });

        state.saveState = "conflict";
        state.errorMessage = "동일한 블록이 다른 변경과 충돌했습니다.";
      } else if (action.payload && "status" in action.payload && action.payload.status === 409) {
        state.queue = buildPendingQueue([...inFlightOps, ...state.queue.ops]);
        inFlightOps.forEach((op) => {

          const block = state.blocks.byId[op.blockId];
          if (block?.status === "saving") {
            block.status = "normal";
            block.remoteContent = undefined;
            block.remoteVersion = undefined;
          }
        });
        state.saveState = "conflict";
        state.errorMessage = "서버 최신 상태와 충돌했습니다. 최신 내용을 다시 불러온 뒤 저장을 재시도하세요.";
      } else if (action.payload && "message" in action.payload && action.payload.message !== "no-op") {
        // Transport/server failures requeue the batch so autosave or manual retry can send it again.
        state.queue = buildPendingQueue([...inFlightOps, ...state.queue.ops]);
        inFlightOps.forEach((op) => {

          const block = state.blocks.byId[op.blockId];
          if (block?.status === "saving") block.status = "normal";
        });
        state.saveState = "error";
        state.errorMessage = action.payload.message;
      }

      state.inFlight = null;
    });
  },
});

/**
 * 에디터 slice 액션 모음입니다.
 */
export const editorActions = editorSlice.actions;

/**
 * 에디터 slice reducer입니다.
 */
export const editorReducer = editorSlice.reducer;
