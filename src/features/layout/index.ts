/**
 * layout 디렉토리의 공개 export를 재노출합니다.
 */

export {
  layoutActions,
  layoutReducer,
  createChildPage,
  fetchLnbDocuments,
  togglePageShared,
} from "@features/layout/state/layout.slice.ts";
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
} from "@features/layout/state/layout.selector.ts";
export { Gnb } from "@features/layout/ui/gnb/Gnb.tsx";
export { Lnb } from "@features/layout/ui/lnb/Lnb.tsx";
export type { LnbActiveKey } from "@features/layout/ui/lnb/Lnb.types.ts";
