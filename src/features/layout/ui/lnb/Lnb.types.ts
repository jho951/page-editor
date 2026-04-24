/**
 * Lnb 관련 타입을 정의합니다.
 */

export type DocRef = {
    id: string;
    title: string;
    emoji?: string;
    updatedAt?: string;
};

export type LastLocation = {
    docId: string;
};

export type PageKey =
    | "home"
    | "allDocs"
    | "shared"
    | "newDocument"
    | "trash"
    | "settings";

export type FolderKey = `folder:${string}`;

export type LnbActiveKey = PageKey | FolderKey;

export type SyncState = "local" | "syncing" | "synced" | "error";

export type FolderItem = {
    id: string;
    key?: LnbActiveKey;

    docId?: string;

    label: string;
    icon?: string;
    children?: FolderItem[];
    syncState?: SyncState;
};

export type TrashItem = {
    id: string;
    label: string;
    deletedAt: number;
};

export type LnbProps = {
    spaceName?: string;
    activeKey?: LnbActiveKey;
    onNavigate?: (key: LnbActiveKey) => void;
    showTopRow?: boolean;
    mobileOverlay?: boolean;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;

    pinnedDocs?: DocRef[];
    recentDocs?: DocRef[];
    onOpenDoc?: (docId: string) => void;

    lastLocation?: LastLocation | null;
    onResumeLast?: (loc: LastLocation) => void;

    folders?: FolderItem[];
    trashItems?: TrashItem[];
};
