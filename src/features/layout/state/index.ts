/**
 * state 디렉토리의 공개 export를 재노출합니다.
 */

export { readLastLocation } from "./layout.storage.ts";
export { initialState, type OpenFolderMap } from "./layout.initial.ts";
export {
    selectFolders,
    selectLastLocation,
    selectLnbOpenFolderIds,
    selectPinnedDocIds,
    selectRecentDocIds,
    selectSharedDocIds,
    selectSidebarActiveKey,
    selectSidebarCollapsed,
    selectTrashItems,
} from "./layout.selector.ts";
export { layoutActions, layoutReducer, createChildPage, togglePageShared } from "./layout.slice.ts";
export type { PageArchiveOp, PageCreateOp, PageId, PageMoveOp, PageRenameOp, ParentId, PendingTxn, TxnId, TxnOp } from "./txn.types.ts";
