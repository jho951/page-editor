/**
 * Folder Node 관련 타입을 정의합니다.
 */

import type { FolderItem, LnbActiveKey } from "./Lnb.types.ts";

export type OpenFolderMap = Record<string, boolean>;

export interface FolderNodeProps {
    node: FolderItem;
    level: number;
    activeKey: LnbActiveKey;
    openFolderIds: OpenFolderMap;
    onToggle: (id: string) => void;
    onNavigate?: (key: LnbActiveKey) => void;
    onAddChild?: (parentId: string) => void;
    onMoveToTrash?: (pageId: string) => void;
    draggingPageId?: string | null;
    dropHint?: {
        targetId: string;
        placement: "before" | "after" | "inside";
    } | null;
    onDragStartPage?: (pageId: string) => void;
    onDragEndPage?: () => void;
    onDragOverPage?: (event: React.DragEvent<HTMLDivElement>, node: FolderItem, level: number) => void;
    onDropPage?: (event: React.DragEvent<HTMLDivElement>, node: FolderItem) => void;
}
