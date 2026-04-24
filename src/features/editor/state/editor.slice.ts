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
  lastTextColor: string | null;
  queue: PendingQueue;
  inFlight: InFlightBatch | null;
  saveState: SaveState;
  lastSavedAt: number | null;
  errorMessage: string | null;
  autosaveScheduledAt: number | null;
  loaded: boolean;
  history: EditorHistoryState;
}

interface EditorHistoryBlockSnapshot {
  id: string;
  parentId: string | null;
  orderKey: string;
  content: EditorContent;
}

interface EditorHistorySnapshot {
  blocks: EditorHistoryBlockSnapshot[];
  selectedBlockId: string | null;
}

interface EditorHistoryEntry {
  before: EditorHistorySnapshot;
  after: EditorHistorySnapshot;
  meta: EditorHistoryMeta;
}

interface EditorHistoryState {
  undoStack: EditorHistoryEntry[];
  redoStack: EditorHistoryEntry[];
  isApplying: boolean;
}

interface EditorHistoryMeta {
  kind: "text" | "change";
  blockId?: string;
  at: number;
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
  lastTextColor: "#2563EB",
  queue: { ops: [], byBlockId: {} },
  inFlight: null,
  saveState: "idle",
  lastSavedAt: null,
  errorMessage: null,
  autosaveScheduledAt: null,
  loaded: false,
  history: {
    undoStack: [],
    redoStack: [],
    isApplying: false,
  },
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
  "document" | "blocks" | "selectedBlockId" | "queue" | "inFlight" | "saveState" | "errorMessage" | "loaded" | "history"
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
    history: {
      undoStack: [],
      redoStack: [],
      isApplying: false,
    },
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

const HISTORY_LIMIT = 100;
const TEXT_HISTORY_BATCH_MS = 900;

function cloneMark(mark: EditorMark): EditorMark {
  return mark.type === "textColor" ? { ...mark } : { type: mark.type };
}

function cloneContent(content: EditorContent): EditorContent {
  return {
    ...content,
    marks: content.marks.map(cloneMark),
  };
}

function sameMark(a: EditorMark, b: EditorMark): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "textColor" && b.type === "textColor") {
    return a.value === b.value;
  }
  return true;
}

function contentEquals(a: EditorContent, b: EditorContent): boolean {
  if (a.type !== b.type) return false;
  if (a.text !== b.text) return false;
  if (Boolean(a.checked) !== Boolean(b.checked)) return false;
  if (a.marks.length !== b.marks.length) return false;
  return a.marks.every((mark, index) => sameMark(mark, b.marks[index]));
}

function captureHistorySnapshot(state: EditorState): EditorHistorySnapshot | null {
  const doc = currentDocument(state);
  if (!doc) return null;

  const childIds = state.blocks.childrenByParentId[doc.rootBlockId] ?? [];
  return {
    blocks: childIds
      .map((blockId) => state.blocks.byId[blockId])
      .filter((block): block is EditorBlockState => Boolean(block))
      .map((block) => ({
        id: block.id,
        parentId: block.parentId,
        orderKey: block.orderKey,
        content: cloneContent(block.draft),
      })),
    selectedBlockId: state.selectedBlockId,
  };
}

function historySnapshotEquals(a: EditorHistorySnapshot | null, b: EditorHistorySnapshot | null): boolean {
  if (!a || !b) return a === b;
  if (a.selectedBlockId !== b.selectedBlockId) return false;
  if (a.blocks.length !== b.blocks.length) return false;

  return a.blocks.every((block, index) => {
    const other = b.blocks[index];
    return (
      block.id === other.id &&
      block.parentId === other.parentId &&
      block.orderKey === other.orderKey &&
      contentEquals(block.content, other.content)
    );
  });
}

function pushHistoryEntry(
  state: EditorState,
  before: EditorHistorySnapshot | null,
  after: EditorHistorySnapshot | null,
  meta: Omit<EditorHistoryMeta, "at">,
): void {
  if (state.history.isApplying) return;
  if (!before || !after) return;
  if (historySnapshotEquals(before, after)) return;

  const nextMeta: EditorHistoryMeta = {
    ...meta,
    at: Date.now(),
  };
  const lastEntry = state.history.undoStack.at(-1);

  if (
    nextMeta.kind === "text" &&
    lastEntry?.meta.kind === "text" &&
    lastEntry.meta.blockId === nextMeta.blockId &&
    nextMeta.at - lastEntry.meta.at <= TEXT_HISTORY_BATCH_MS
  ) {
    state.history.undoStack = [
      ...state.history.undoStack.slice(0, -1),
      {
        ...lastEntry,
        after,
        meta: nextMeta,
      },
    ];
    state.history.redoStack = [];
    return;
  }

  state.history.undoStack = [...state.history.undoStack, { before, after, meta: nextMeta }].slice(-HISTORY_LIMIT);
  state.history.redoStack = [];
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
  remapHistoryStacks(state, idMappings);
}

function hydrateQueuedOperationVersions(state: EditorState): void {
  state.queue = buildPendingQueue(
    state.queue.ops.map((op) => {
      if (op.type === "block.create" || typeof op.version === "number" || op.blockId.startsWith("tmp:block:")) {
        return op;
      }

      const block = state.blocks.byId[op.blockId];
      if (!block) return op;

      return {
        ...op,
        version: block.version,
      };
    })
  );
}

function transactionVersion(blockId: string, version: number): number | undefined {
  return blockId.startsWith("tmp:block:") ? undefined : version;
}

function remapHistorySnapshot(
  snapshot: EditorHistorySnapshot,
  idMappings: Record<string, string>,
): EditorHistorySnapshot {
  return {
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      id: idMappings[block.id] ?? block.id,
      parentId: block.parentId ? (idMappings[block.parentId] ?? block.parentId) : null,
      content: cloneContent(block.content),
    })),
    selectedBlockId: snapshot.selectedBlockId ? (idMappings[snapshot.selectedBlockId] ?? snapshot.selectedBlockId) : null,
  };
}

function remapHistoryEntry(
  entry: EditorHistoryEntry,
  idMappings: Record<string, string>,
): EditorHistoryEntry {
  return {
    before: remapHistorySnapshot(entry.before, idMappings),
    after: remapHistorySnapshot(entry.after, idMappings),
    meta: {
      ...entry.meta,
      blockId: entry.meta.blockId ? (idMappings[entry.meta.blockId] ?? entry.meta.blockId) : undefined,
    },
  };
}

function remapHistoryStacks(state: EditorState, idMappings: Record<string, string>): void {
  const entries = Object.entries(idMappings);
  if (entries.length === 0) return;

  state.history.undoStack = state.history.undoStack.map((entry) => remapHistoryEntry(entry, idMappings));
  state.history.redoStack = state.history.redoStack.map((entry) => remapHistoryEntry(entry, idMappings));
}

function createBlockFromHistory(
  state: EditorState,
  parentId: string,
  blockSnapshot: EditorHistoryBlockSnapshot,
  actualId: string,
): void {
  const content = cloneContent(blockSnapshot.content);
  const order = state.blocks.childrenByParentId[parentId] ?? [];

  state.blocks.byId[actualId] = {
    id: actualId,
    parentId,
    orderKey: createOrderKey(order.length),
    version: 0,
    draft: content,
    lastSynced: content,
    status: "normal",
  };
  setCurrentBlockOrder(state, parentId, [...order, actualId]);

  const { afterBlockId, beforeBlockId } = siblingContext(state, parentId, actualId);
  enqueue(state, {
    type: "block.create",
    blockId: actualId,
    parentId,
    afterBlockId,
    beforeBlockId,
    orderKey: state.blocks.byId[actualId].orderKey,
  });
  enqueue(state, {
    type: "block.replace_content",
    blockId: actualId,
    version: transactionVersion(actualId, state.blocks.byId[actualId].version),
    content,
  });
}

function deleteBlockFromHistory(state: EditorState, blockId: string): void {
  const block = state.blocks.byId[blockId];
  if (!block) return;

  if (block.parentId) {
    const order = state.blocks.childrenByParentId[block.parentId] ?? [];
    setCurrentBlockOrder(state, block.parentId, order.filter((candidateId) => candidateId !== blockId));
  }

  removeSubtreeFromState(state, blockId);
  enqueue(state, {
    type: "block.delete",
    blockId,
    version: transactionVersion(blockId, block.version),
  });
}

function reorderChildrenFromHistory(state: EditorState, parentId: string, nextOrder: string[]): void {
  const currentOrder = state.blocks.childrenByParentId[parentId] ?? [];
  if (
    currentOrder.length === nextOrder.length &&
    currentOrder.every((blockId, index) => blockId === nextOrder[index])
  ) {
    return;
  }

  setCurrentBlockOrder(state, parentId, nextOrder);
  nextOrder.forEach((blockId) => {
    const block = state.blocks.byId[blockId];
    if (!block) return;

    const { afterBlockId, beforeBlockId } = siblingContext(state, parentId, blockId);
    enqueue(state, {
      type: "block.move",
      blockId,
      version: transactionVersion(blockId, block.version),
      parentId,
      afterBlockId,
      beforeBlockId,
      orderKey: block.orderKey,
    });
  });
}

function applyHistorySnapshot(state: EditorState, snapshot: EditorHistorySnapshot): Record<string, string> {
  const doc = currentDocument(state);
  if (!doc) return {};

  const parentId = doc.rootBlockId;
  const idMappings: Record<string, string> = {};

  snapshot.blocks.forEach((blockSnapshot) => {
    const actualId = state.blocks.byId[blockSnapshot.id] ? blockSnapshot.id : `tmp:block:${generateId()}`;
    if (state.blocks.byId[blockSnapshot.id]) return;

    idMappings[blockSnapshot.id] = actualId;
    createBlockFromHistory(state, parentId, blockSnapshot, actualId);
  });

  const targetOrder = snapshot.blocks.map((blockSnapshot) => idMappings[blockSnapshot.id] ?? blockSnapshot.id);
  const targetSet = new Set(targetOrder);
  const currentOrder = [...(state.blocks.childrenByParentId[parentId] ?? [])];

  currentOrder.forEach((blockId) => {
    if (!targetSet.has(blockId)) {
      deleteBlockFromHistory(state, blockId);
    }
  });

  snapshot.blocks.forEach((blockSnapshot) => {
    const actualId = idMappings[blockSnapshot.id] ?? blockSnapshot.id;
    const block = state.blocks.byId[actualId];
    if (!block) return;

    const nextContent = cloneContent(blockSnapshot.content);
    if (!contentEquals(block.draft, nextContent)) {
      markBlockDirty(state, actualId, nextContent);
    }
  });

  const visibleTargetOrder = targetOrder.filter((blockId) => Boolean(state.blocks.byId[blockId]));
  reorderChildrenFromHistory(state, parentId, visibleTargetOrder);

  const selectedBlockId = snapshot.selectedBlockId ? (idMappings[snapshot.selectedBlockId] ?? snapshot.selectedBlockId) : null;
  state.selectedBlockId = selectedBlockId && state.blocks.byId[selectedBlockId]
    ? selectedBlockId
    : visibleTargetOrder[0] ?? null;

  return idMappings;
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
    undo(state) {
      const entry = state.history.undoStack.at(-1);
      if (!entry) return;

      state.history.undoStack = state.history.undoStack.slice(0, -1);
      state.history.isApplying = true;

      const idMappings = applyHistorySnapshot(state, entry.before);
      remapHistoryStacks(state, idMappings);
      state.history.redoStack = [...state.history.redoStack, remapHistoryEntry(entry, idMappings)].slice(-HISTORY_LIMIT);
      state.history.isApplying = false;
    },
    redo(state) {
      const entry = state.history.redoStack.at(-1);
      if (!entry) return;

      state.history.redoStack = state.history.redoStack.slice(0, -1);
      state.history.isApplying = true;

      const idMappings = applyHistorySnapshot(state, entry.after);
      remapHistoryStacks(state, idMappings);
      state.history.undoStack = [...state.history.undoStack, remapHistoryEntry(entry, idMappings)].slice(-HISTORY_LIMIT);
      state.history.isApplying = false;
    },
    updateBlockText(state, action: PayloadAction<{ blockId: string; text: string }>) {
      const before = captureHistorySnapshot(state);

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = { ...block.draft, text: action.payload.text };
      markBlockDirty(state, action.payload.blockId, next);
      pushHistoryEntry(state, before, captureHistorySnapshot(state), {
        kind: "text",
        blockId: action.payload.blockId,
      });
    },
    toggleBlockMark(state, action: PayloadAction<{ blockId: string; markType: "bold" | "italic" | "underline" | "strikethrough" }>) {
      const before = captureHistorySnapshot(state);

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        marks: toggleMark(block.draft.marks, action.payload.markType),
      };
      markBlockDirty(state, action.payload.blockId, next);
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    setBlockTextColor(state, action: PayloadAction<{ blockId: string; value: string | null }>) {
      const before = captureHistorySnapshot(state);

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        marks: setTextColorMark(block.draft.marks, action.payload.value),
      };
      markBlockDirty(state, action.payload.blockId, next);
      if (action.payload.value) {
        state.lastTextColor = action.payload.value;
      }
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    setBlockType(state, action: PayloadAction<{ blockId: string; type: EditorContent["type"] }>) {
      const before = captureHistorySnapshot(state);

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;

      const next = {
        ...block.draft,
        type: action.payload.type,
        checked: action.payload.type === "to_do" ? Boolean(block.draft.checked) : false,
      };
      markBlockDirty(state, action.payload.blockId, next);
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    toggleTodoChecked(state, action: PayloadAction<{ blockId: string }>) {
      const before = captureHistorySnapshot(state);

      const block = state.blocks.byId[action.payload.blockId];
      if (!block) return;
      if (block.draft.type !== "to_do") return;

      const next = { ...block.draft, checked: !block.draft.checked };
      markBlockDirty(state, action.payload.blockId, next);
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    insertBlockAfter(state, action: PayloadAction<{ afterBlockId: string | null }>) {
      const before = captureHistorySnapshot(state);

      const anchorBlock = action.payload.afterBlockId
        ? state.blocks.byId[action.payload.afterBlockId] ?? null
        : null;

      const parentId = anchorBlock?.parentId ?? selectedParentId(state);
      if (!parentId) return;

      const order = state.blocks.childrenByParentId[parentId] ?? [];
      const id = `tmp:block:${generateId()}`;
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
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    splitBlockAtSelection(
      state,
      action: PayloadAction<{ blockId: string; sourceText?: string; selectionStart: number; selectionEnd: number }>
    ) {
      const before = captureHistorySnapshot(state);

      const current = state.blocks.byId[action.payload.blockId];
      if (!current || !current.parentId) return;

      const sourceText = action.payload.sourceText ?? current.draft.text ?? "";
      const selectionStart = Math.max(0, Math.min(action.payload.selectionStart, sourceText.length));
      const selectionEnd = Math.max(selectionStart, Math.min(action.payload.selectionEnd, sourceText.length));
      const beforeText = sourceText.slice(0, selectionStart);
      const afterText = sourceText.slice(selectionEnd);

      const nextId = `tmp:block:${generateId()}`;
      const nextContent: EditorContent =
        afterText.length > 0
          ? {
              ...current.draft,
              text: afterText,
            }
          : {
              type: "paragraph",
              text: "",
              checked: false,
              marks: [],
            };

      state.blocks.byId[nextId] = {
        id: nextId,
        parentId: current.parentId,
        orderKey: createOrderKey(0),
        version: 0,
        draft: nextContent,
        lastSynced: nextContent,
        status: "normal",
      };

      const order = state.blocks.childrenByParentId[current.parentId] ?? [];
      const currentIndex = order.indexOf(current.id);
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : order.length;
      const nextOrder = [...order];
      nextOrder.splice(insertAt, 0, nextId);
      setCurrentBlockOrder(state, current.parentId, nextOrder);

      if (beforeText !== sourceText || selectionEnd !== selectionStart) {
        markBlockDirty(state, current.id, {
          ...current.draft,
          text: beforeText,
        });
      }

      state.selectedBlockId = nextId;

      const { afterBlockId, beforeBlockId } = siblingContext(state, current.parentId, nextId);

      enqueue(state, {
        type: "block.create",
        blockId: nextId,
        parentId: current.parentId,
        afterBlockId,
        beforeBlockId,
        orderKey: state.blocks.byId[nextId].orderKey,
      });

      if (afterText.length > 0) {
        enqueue(state, {
          type: "block.replace_content",
          blockId: nextId,
          version: transactionVersion(nextId, state.blocks.byId[nextId].version),
          content: nextContent,
        });
      }
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    duplicateSelectedBlock(state) {
      const before = captureHistorySnapshot(state);

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
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    deleteSelectedBlock(state) {
      const before = captureHistorySnapshot(state);

      const current = selectedBlock(state);
      if (!current) return;

      const order = currentBlockOrder(state);
      const currentIndex = order.indexOf(current.id);
      const nextOrder = order.filter((blockId) => blockId !== current.id);
      if (current.parentId) {
        setCurrentBlockOrder(state, current.parentId, nextOrder);
      }
      removeSubtreeFromState(state, current.id);
      if (nextOrder.length === 0) {
        state.selectedBlockId = null;
      } else {
        const fallbackIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        state.selectedBlockId = nextOrder[fallbackIndex] ?? nextOrder[0] ?? null;
      }

      enqueue(state, {
        type: "block.delete",
        blockId: current.id,
        version: transactionVersion(current.id, current.version),
      });
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    moveSelectedBlock(state, action: PayloadAction<"up" | "down">) {
      const before = captureHistorySnapshot(state);

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
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
    },
    moveBlockByDrop(
      state,
      action: PayloadAction<{ blockId: string; targetBlockId: string; placement: "before" | "after" }>
    ) {
      const before = captureHistorySnapshot(state);

      const current = state.blocks.byId[action.payload.blockId];
      const target = state.blocks.byId[action.payload.targetBlockId];
      if (!current || !target) return;
      if (current.id === target.id) return;
      if (!current.parentId || current.parentId !== target.parentId) return;

      const order = state.blocks.childrenByParentId[current.parentId] ?? [];
      const currentIndex = order.indexOf(current.id);
      const targetIndex = order.indexOf(target.id);
      if (currentIndex < 0 || targetIndex < 0) return;

      const nextOrder = [...order];
      nextOrder.splice(currentIndex, 1);

      const targetIndexAfterRemoval = nextOrder.indexOf(target.id);
      const insertAt = action.payload.placement === "before" ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;
      nextOrder.splice(insertAt, 0, current.id);

      const nextIndex = nextOrder.indexOf(current.id);
      if (nextIndex === currentIndex) return;

      setCurrentBlockOrder(state, current.parentId, nextOrder);
      state.selectedBlockId = current.id;

      const { afterBlockId, beforeBlockId } = siblingContext(state, current.parentId, current.id);

      enqueue(state, {
        type: "block.move",
        blockId: current.id,
        version: transactionVersion(current.id, current.version),
        parentId: current.parentId,
        afterBlockId,
        beforeBlockId,
        orderKey: current.orderKey,
      });
      pushHistoryEntry(state, before, captureHistorySnapshot(state), { kind: "change" });
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
      if (action.payload.command === "undo-edit") {
        editorSlice.caseReducers.undo(state);
        return;
      }

      if (action.payload.command === "redo-edit") {
        editorSlice.caseReducers.redo(state);
        return;
      }

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
        case "apply-last-color":
          editorSlice.caseReducers.setBlockTextColor(state, {
            type: action.type,
            payload: {
              blockId: block.id,
              value: state.lastTextColor ?? "#2563EB",
            },
          });
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

      hydrateQueuedOperationVersions(state);

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
