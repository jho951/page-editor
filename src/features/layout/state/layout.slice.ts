/**
 * LNB 상태, 최근/고정/공유 페이지 목록, 페이지 생성 흐름을 관리합니다.
 */

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { LnbActiveKey, FolderItem } from "@features/layout/ui/lnb/Lnb.types.ts";
import { initialState, type OpenFolderMap } from "@features/layout/state/layout.initial.ts";
import { documentsApi } from "@shared/api/client.ts";
import { endpoints } from "@shared/api/endpoints.ts";
import { unwrapApiEnvelope } from "@shared/api/service-contract.ts";
import type { ApiEnvelope, TrashDocumentResponse } from "@shared/api/service-contract.ts";
import { pagesApi, type ListDocumentsItem } from "@features/layout/api/pages.ts";
import { upsertCatalogItem } from "@features/document/index.ts";
import type { TrashItem } from "@features/layout/ui/lnb/Lnb.types.ts";

/**
 * 지정한 부모 폴더 아래에 새 페이지를 추가합니다.
 *
 * @param nodes 검사하거나 수정할 트리 노드 목록입니다.
 * @param parentId 기준이 되는 부모 블록 또는 폴더 ID입니다.
 * @param child 추가할 하위 페이지 노드입니다.
 * @returns 대상 부모를 찾아 추가에 성공하면 true, 실패하면 false를 반환합니다.
 */
function addChildById(nodes: FolderItem[], parentId: string, child: FolderItem): boolean {
    for (const n of nodes) {
        if (n.id === parentId) {
            n.children = n.children ? [...n.children, child] : [child];
            return true;
        }
        if (n.children?.length) {

            const ok = addChildById(n.children, parentId, child);
            if (ok) return true;
        }
    }
    return false;
}

/**
 * 트리에서 페이지를 제거하고 제거된 항목을 반환합니다.
 *
 * @param nodes 검사하거나 수정할 트리 노드 목록입니다.
 * @param pageId 대상 페이지 ID입니다.
 * @returns 제거된 페이지와 제거 후 트리 목록을 함께 반환합니다.
 */
function removePageById(
    nodes: FolderItem[],
    pageId: string
): { removed: FolderItem | null; next: FolderItem[] } {
    let removed: FolderItem | null = null;

    const next = nodes.flatMap((n) => {

        const isTarget =
            n.id === pageId ||
            n.docId === pageId ||
            n.key === (`folder:${pageId}` as LnbActiveKey);

        if (isTarget) {
            removed = n;
            return [];
        }

        if (n.children?.length) {

            const childResult = removePageById(n.children, pageId);
            if (childResult.removed) removed = childResult.removed;
            return [{ ...n, children: childResult.next }];
        }

        return [n];
    });

    return { removed, next };
}

/**
 * 트리 안에 지정한 페이지 ID가 이미 존재하는지 확인합니다.
 *
 * @param nodes 검사하거나 수정할 트리 노드 목록입니다.
 * @param pageId 대상 페이지 ID입니다.
 * @returns 페이지가 있으면 true, 없으면 false를 반환합니다.
 */
function hasPageId(nodes: FolderItem[], pageId: string): boolean {
    for (const n of nodes) {
        if (n.id === pageId || n.docId === pageId || n.key === (`folder:${pageId}` as LnbActiveKey)) return true;
        if (n.children?.length && hasPageId(n.children, pageId)) return true;
    }
    return false;
}

function toFolderNode(item: ListDocumentsItem): FolderItem | null {
    const id = item.id == null ? "" : String(item.id);
    if (!id) return null;

    const label = String(item.title ?? item.name ?? "제목 없음");
    return {
        id,
        docId: id,
        key: `folder:${id}` as LnbActiveKey,
        label,
  };
}

type DocumentTreeNode = {
    id: string;
    parentId: string | null;
    node: FolderItem;
};

type RemoteTrashItem = TrashDocumentResponse & {
    id?: string | number;
    label?: string;
    name?: string;
};

function toTrashItem(item: RemoteTrashItem): TrashItem | null {
    const idSource = item.documentId ?? item.id;
    const id = idSource == null ? "" : String(idSource);
    if (!id) return null;

    const deletedAt =
        typeof item.deletedAt === "number"
            ? item.deletedAt
            : item.deletedAt
              ? Date.parse(String(item.deletedAt))
              : Date.now();

    return {
        id,
        label: String(item.title ?? item.label ?? item.name ?? "제목 없음"),
        deletedAt: Number.isFinite(deletedAt) ? deletedAt : Date.now(),
    };
}

function toDocumentTreeNode(item: ListDocumentsItem): DocumentTreeNode | null {
    const node = toFolderNode(item);
    if (!node) return null;

    return {
        id: node.id,
        parentId: item.parentId == null || item.parentId === "" ? null : String(item.parentId),
        node: {
            ...node,
            children: [],
        },
    };
}

function buildDocumentTree(items: ListDocumentsItem[]): FolderItem[] {
    const entries = items
        .map((item) => toDocumentTreeNode(item))
        .filter((item): item is DocumentTreeNode => item !== null);

    const nodeById = new Map(entries.map((entry) => [entry.id, entry.node]));
    const roots: FolderItem[] = [];

    for (const entry of entries) {
        const { parentId, node } = entry;
        if (parentId && parentId !== entry.id) {
            const parent = nodeById.get(parentId);
            if (parent) {
                parent.children = parent.children ? [...parent.children, node] : [node];
                continue;
            }
        }

        roots.push(node);
    }

    return roots;
}

/**
 * LNB 문서 목록을 `/v1/documents`에서 조회합니다.
 */
export const fetchLnbDocuments = createAsyncThunk<
    FolderItem[],
    void,
    { rejectValue: string }
>("layout/fetchLnbDocuments", async (_arg, { rejectWithValue }) => {
    try {
        const items = await pagesApi.listDocuments();
        return buildDocumentTree(items);
    } catch (error) {
        return rejectWithValue(error instanceof Error ? error.message : "fetch documents failed");
    }
});

/**
 * 휴지통 문서 목록을 `/v1/documents/trash`에서 조회합니다.
 */
export const fetchTrashDocumentsRemote = createAsyncThunk<
    TrashItem[],
    void,
    { rejectValue: string }
>("layout/fetchTrashDocumentsRemote", async (_arg, { rejectWithValue }) => {
    try {
        const response = await documentsApi.get<ApiEnvelope<RemoteTrashItem[]> | RemoteTrashItem[]>(
            endpoints.documentsTrash
        );

        const unwrapped = unwrapApiEnvelope(response);
        return (Array.isArray(unwrapped) ? unwrapped : [])
            .map((item) => toTrashItem(item))
            .filter((item): item is TrashItem => item !== null);
    } catch (error) {
        return rejectWithValue(error instanceof Error ? error.message : "fetch trash failed");
    }
});

/**
 * 레이아웃 상태와 관련 reducer를 정의하는 slice입니다.
 */
const layoutSlice = createSlice({
    name: "layout",
    initialState,
    reducers: {
        setActiveKey(state, action: PayloadAction<LnbActiveKey>) {
            state.activeKey = action.payload;
        },
        toggleSidebarCollapsed(state) {
            state.sidebarCollapsed = !state.sidebarCollapsed;
        },
        setSidebarCollapsed(state, action: PayloadAction<boolean>) {
            state.sidebarCollapsed = action.payload;
        },

        toggleFolderOpen(state, action: PayloadAction<string>) {

            const id = action.payload;
            state.openFolderIds[id] = !state.openFolderIds[id];
        },

        setFolderOpen(state, action: PayloadAction<{ id: string; open: boolean }>) {
            const { id, open } = action.payload;
            state.openFolderIds[id] = open;
        },

        setOpenFolderIds(state, action: PayloadAction<OpenFolderMap>) {
            state.openFolderIds = action.payload;
        },

        addChildPage(
            state,
            action: PayloadAction<{ parentId: string; childId: string; title?: string }>
        ) {
            const { parentId, childId, title } = action.payload;

            const child: FolderItem = {
                id: childId,
                label: title ?? "새 페이지",
                key: `folder:${childId}`,
                docId: childId,
            };

            addChildById(state.folders, parentId, child);

            state.openFolderIds[parentId] = true;
        },

        movePageToTrash(state, action: PayloadAction<{ pageId: string }>) {

            const pageId = action.payload.pageId;
            if (!pageId) return;

            const result = removePageById(state.folders, pageId);
            if (!result.removed) return;

            state.folders = result.next;
            state.recentDocIds = state.recentDocIds.filter((id) => id !== pageId);
            state.pinnedDocIds = state.pinnedDocIds.filter((id) => id !== pageId);

            const label = result.removed.label || "제목 없음";
            state.trashItems = [
                { id: pageId, label, deletedAt: Date.now() },
                ...state.trashItems.filter((t) => t.id !== pageId),
            ];

            if (state.activeKey === (`folder:${pageId}` as LnbActiveKey)) {
                state.activeKey = "home";
            }
        },
        restorePageFromTrash(state, action: PayloadAction<{ pageId: string }>) {

            const pageId = action.payload.pageId;
            if (!pageId) return;

            const item = state.trashItems.find((t) => t.id === pageId);
            if (!item) return;
            if (hasPageId(state.folders, pageId)) {
                state.trashItems = state.trashItems.filter((t) => t.id !== pageId);
                return;
            }

            const restored: FolderItem = {
                id: pageId,
                docId: pageId,
                key: `folder:${pageId}` as LnbActiveKey,
                label: item.label || "복구된 페이지",
            };

            const inserted = addChildById(state.folders, "my", restored);
            if (!inserted) {
                state.folders = [
                    ...state.folders,
                    { id: "my", label: "개인 페이지", icon: "folder", children: [restored] },
                ];
            }

            state.openFolderIds.my = true;
            state.trashItems = state.trashItems.filter((t) => t.id !== pageId);
        },
        permanentDeleteFromTrash(state, action: PayloadAction<{ pageId: string }>) {

            const pageId = action.payload.pageId;
            if (!pageId) return;
            state.trashItems = state.trashItems.filter((t) => t.id !== pageId);
        },

        recordRecent(state, action: PayloadAction<string>) {

            const docId = action.payload;
            if (!docId) return;
            state.recentDocIds = [docId, ...state.recentDocIds.filter((id) => id !== docId)].slice(0, 20);
        },

        togglePinned(state, action: PayloadAction<string>) {

            const docId = action.payload;
            if (!docId) return;

            const has = state.pinnedDocIds.includes(docId);
            state.pinnedDocIds = has
                ? state.pinnedDocIds.filter((id) => id !== docId)
                : [docId, ...state.pinnedDocIds].slice(0, 50);
        },
        setDocShared(state, action: PayloadAction<{ docId: string; shared: boolean }>) {
            const { docId, shared } = action.payload;
            if (!docId) return;

            const has = state.sharedDocIds.includes(docId);
            if (shared && !has) {
                state.sharedDocIds = [docId, ...state.sharedDocIds].slice(0, 200);
                return;
            }
            if (!shared && has) {
                state.sharedDocIds = state.sharedDocIds.filter((id) => id !== docId);
            }
        },

        setLastLocation(state, action: PayloadAction<{ docId: string } | null>) {
            state.lastLocation = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchLnbDocuments.fulfilled, (state, action) => {
            const nextChildren = action.payload;
            const myFolderIndex = state.folders.findIndex((item) => item.id === "my");

            if (myFolderIndex >= 0) {
                state.folders[myFolderIndex] = {
                    ...state.folders[myFolderIndex],
                    children: nextChildren,
                };
                return;
            }

            state.folders = [
                {
                    id: "my",
                    label: "개인 페이지",
                    icon: "folder",
                    children: nextChildren,
                },
                ...state.folders,
            ];
        });

        builder.addCase(fetchTrashDocumentsRemote.fulfilled, (state, action) => {
            state.trashItems = action.payload;
        });
    },
});

/**
 * 레이아웃 slice 액션 모음입니다.
 */
export const layoutActions = layoutSlice.actions;

/**
 * 하위 페이지를 생성하고 상태에 반영하는 thunk입니다.
 */
export const createChildPage = createAsyncThunk<
  { documentId: string; key: LnbActiveKey },
  { parentId: string },
  { rejectValue: string }
>("layout/createChildPage", async ({ parentId }, { dispatch, rejectWithValue }) => {
  try {
    const response = await pagesApi.createPage({
      parentId,
      title: "새 페이지",
    });

    const documentId = response.id;
    if (!documentId) {
      return rejectWithValue("create page failed");
    }

    dispatch(
      layoutActions.addChildPage({
        parentId,
        childId: documentId,
        title: response.title ?? "새 페이지",
      })
    );

    dispatch(layoutActions.setActiveKey((`folder:${documentId}`) as LnbActiveKey));

    upsertCatalogItem({
      id: documentId,
      title: response.title ?? "새 페이지",
      accent: "#D7D7D7",
      kind: "documents",
    });

    return { documentId, key: (`folder:${documentId}`) as LnbActiveKey };
  } catch (e) {

    const msg = e instanceof Error ? e.message : "create page failed";
    return rejectWithValue(msg);
  }
});

/**
 * 페이지 공유 상태를 전환하는 thunk입니다.
 */
export const togglePageShared = createAsyncThunk<
  { docId: string; shared: boolean },
  { docId: string },
  { rejectValue: string }
>("layout/togglePageShared", async ({ docId }, { dispatch, getState, rejectWithValue }) => {

  const state = getState() as { layout: { sharedDocIds: string[] } };

  const currentShared = state.layout.sharedDocIds.includes(docId);

  const nextShared = !currentShared;

  dispatch(layoutActions.setDocShared({ docId, shared: nextShared }));
  try {
    const metadata = await pagesApi.getPage(docId);
    const currentVisibility = metadata.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
    const targetVisibility = nextShared ? "PUBLIC" : "PRIVATE";

    if (currentVisibility !== targetVisibility) {
      await pagesApi.updatePageVisibility(docId, {
        visibility: targetVisibility,
        version: metadata.version ?? 0,
      });
    }
  } catch (e) {
    dispatch(layoutActions.setDocShared({ docId, shared: currentShared }));

    const msg = e instanceof Error ? e.message : "toggle share failed";
    return rejectWithValue(msg);
  }

  return { docId, shared: nextShared };
});

/**
 * 문서를 휴지통으로 이동하는 thunk입니다.
 */
export const movePageToTrashRemote = createAsyncThunk<
  { pageId: string },
  { pageId: string },
  { rejectValue: string }
>("layout/movePageToTrashRemote", async ({ pageId }, { dispatch, rejectWithValue }) => {
  dispatch(layoutActions.movePageToTrash({ pageId }));
  try {
    await pagesApi.moveToTrash(pageId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "move to trash failed";
    return rejectWithValue(msg);
  }
  return { pageId };
});

/**
 * 휴지통 문서를 복구하는 thunk입니다.
 */
export const restorePageFromTrashRemote = createAsyncThunk<
  { pageId: string },
  { pageId: string },
  { rejectValue: string }
>("layout/restorePageFromTrashRemote", async ({ pageId }, { dispatch, rejectWithValue }) => {
  dispatch(layoutActions.restorePageFromTrash({ pageId }));
  try {
    await pagesApi.restoreFromTrash(pageId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "restore page failed";
    return rejectWithValue(msg);
  }
  return { pageId };
});

/**
 * 휴지통 문서를 완전 삭제하는 thunk입니다.
 */
export const permanentDeletePageRemote = createAsyncThunk<
  { pageId: string },
  { pageId: string },
  { rejectValue: string }
>("layout/permanentDeletePageRemote", async ({ pageId }, { dispatch, rejectWithValue }) => {
  dispatch(layoutActions.permanentDeleteFromTrash({ pageId }));
  try {
    await pagesApi.deleteFromTrash(pageId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "permanent delete failed";
    return rejectWithValue(msg);
  }
  return { pageId };
});

/**
 * 레이아웃 slice reducer입니다.
 */
export const layoutReducer = layoutSlice.reducer;
