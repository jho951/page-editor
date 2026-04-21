/**
 * 기본 LNB 폴더/메뉴 구조를 정의합니다.
 */

import type { FolderItem } from "@features/layout/ui/lnb/Lnb.types.ts";

/**
 * LNB에 표시할 기본 폴더 및 페이지 트리입니다.
 */
export const DEFAULT_FOLDER: FolderItem[] = [
    {
        id: "my",
        label: "개인 페이지",
        icon: "folder",
        children: [],
    },
    {
        id: "pinned",
        label: "즐겨찾기",
        icon: "star",
        children: [
            { id: "documents", key: "allDocs", label: "Documents", icon: "star" },
        ],
    },
];
