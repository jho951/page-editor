/**
 * 왼쪽 탐색 영역 전체를 렌더링합니다.
 */

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "@app/store/store.ts";
import { useNavigate } from "react-router-dom";

import { createChildPage, fetchLnbDocuments, layoutActions, movePageToTrashRemote } from "@features/layout/state/layout.slice.ts";
import { selectAuthInitialized, selectIsAuthenticated } from "@features/auth/index.ts";
import type { FolderItem, LnbActiveKey, LnbProps } from "@features/layout/ui/lnb/Lnb.types.ts";
import { selectFolders, selectLnbOpenFolderIds } from "@features/layout/state/layout.selector.ts";
import { FolderNode } from "@features/layout/ui/lnb/FolderNode.tsx";
import { pagesApi } from "@features/layout/api/pages.ts";
import { uiActions } from "@app/state/ui.slice.ts";

import { Button, Divider, Icon } from "@jho951/ui-components";

import styles from "./Lnb.module.css";

/**
 * 왼쪽 탐색 영역과 페이지 트리를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function Lnb({ activeKey = "home", onNavigate, showTopRow = true, mobileOverlay = false }: LnbProps) {
    const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
    const [dropHint, setDropHint] = useState<{
        targetId: string;
        placement: "before" | "after" | "inside";
    } | null>(null);

    const navigate = useNavigate();

    const dispatch = useDispatch<AppDispatch>();

    const toggleFolder = (id: string) => dispatch(layoutActions.toggleFolderOpen(id));

    const authInitialized = useSelector(selectAuthInitialized);
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const openFolderIds = useSelector(selectLnbOpenFolderIds);

    const folders = useSelector(selectFolders);

    useEffect(() => {
        if (!authInitialized || !isAuthenticated) return;
        void dispatch(fetchLnbDocuments());
    }, [authInitialized, dispatch, isAuthenticated]);

    const go = (key: LnbActiveKey) => {
        onNavigate?.(key);
        dispatch(layoutActions.setActiveKey(key));
    };

    const addChild = (parentId: string) => {
        dispatch(createChildPage({ parentId })).then((action) => {
            if (!createChildPage.fulfilled.match(action)) return;

            const newId = action.payload.documentId;

            const newKey = `folder:${newId}` as LnbActiveKey;
            go(newKey);
            navigate(`/doc/${newId}`);
        });
    };

    const moveToTrash = (pageId: string) => {
        void dispatch(movePageToTrashRemote({ pageId }));
        if (activeKey === (`folder:${pageId}` as LnbActiveKey)) {
            navigate("/");
            go("home");
        }
    };

    const resolvePageId = (node: FolderItem): string => node.docId ?? node.id;

    const findNodeContext = (
        nodes: FolderItem[],
        targetId: string,
        parent: FolderItem | null = null,
    ): { node: FolderItem; parent: FolderItem | null } | null => {
        for (const candidate of nodes) {
            if (resolvePageId(candidate) === targetId || candidate.id === targetId) {
                return { node: candidate, parent };
            }

            if (candidate.children?.length) {
                const found = findNodeContext(candidate.children, targetId, candidate);
                if (found) return found;
            }
        }

        return null;
    };

    const collectSubtreePageIds = (node: FolderItem): Set<string> => {
        const ids = new Set<string>([resolvePageId(node)]);

        node.children?.forEach((child) => {
            collectSubtreePageIds(child).forEach((id) => ids.add(id));
        });

        return ids;
    };

    const getRootPersonalFolder = (): FolderItem | undefined =>
        folders.find((folder) => folder.id === "my");

    const getSiblingPageIds = (parent: FolderItem | null): string[] => {
        if (!parent || parent.id === "my") {
            return (getRootPersonalFolder()?.children ?? []).map((child) => resolvePageId(child));
        }

        return (parent.children ?? []).map((child) => resolvePageId(child));
    };

    const movePageByDrag = async (
        draggedId: string,
        targetNode: FolderItem,
        placement: "before" | "after" | "inside",
    ): Promise<void> => {
        const draggedContext = findNodeContext(folders, draggedId);
        const targetContext = findNodeContext(folders, resolvePageId(targetNode));

        if (!draggedContext || !targetContext) return;

        const draggedSubtreeIds = collectSubtreePageIds(draggedContext.node);
        const targetPageId = resolvePageId(targetContext.node);

        if (draggedSubtreeIds.has(targetPageId)) return;

        let targetParentId: string | null = null;
        let afterDocumentId: string | null = null;
        let beforeDocumentId: string | null = null;

        if (placement === "inside") {
            targetParentId = targetContext.node.id;

            const childIds = (targetContext.node.children ?? [])
                .map((child) => resolvePageId(child))
                .filter((id) => id !== draggedId);

            afterDocumentId = childIds.length > 0 ? childIds[childIds.length - 1] : null;
        } else {
            const siblingIds = getSiblingPageIds(targetContext.parent).filter((id) => id !== draggedId);
            const targetIndex = siblingIds.indexOf(targetPageId);
            if (targetIndex < 0) return;

            const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
            siblingIds.splice(insertIndex, 0, draggedId);

            const finalIndex = siblingIds.indexOf(draggedId);
            beforeDocumentId = finalIndex < siblingIds.length - 1 ? siblingIds[finalIndex + 1] : null;
            afterDocumentId = finalIndex > 0 ? siblingIds[finalIndex - 1] : null;
            targetParentId = targetContext.parent?.id ?? "my";
        }

        try {
            await pagesApi.moveDocument(draggedId, {
                targetParentId,
                afterDocumentId,
                beforeDocumentId,
            });

            if (placement === "inside") {
                dispatch(layoutActions.setFolderOpen({ id: targetContext.node.id, open: true }));
            }

            await dispatch(fetchLnbDocuments()).unwrap();
        } catch {
            dispatch(uiActions.showToast({ message: "문서를 이동하지 못했습니다.", duration: 3000 }));
        }
    };

    const handleDragOverPage = (
        event: React.DragEvent<HTMLDivElement>,
        node: FolderItem,
        level: number,
    ) => {
        if (!draggingPageId) return;

        const pageId = resolvePageId(node);
        if (draggingPageId === pageId) return;

        event.preventDefault();

        const rect = event.currentTarget.getBoundingClientRect();
        const isSection = level === 0;
        const insideThreshold = rect.left + 72 + level * 12;
        const placement = isSection
            ? "inside"
            : event.clientX > insideThreshold
              ? "inside"
              : event.clientY < rect.top + rect.height / 2
                ? "before"
                : "after";

        setDropHint({
            targetId: pageId,
            placement,
        });
    };

    const handleDropPage = (event: React.DragEvent<HTMLDivElement>, node: FolderItem) => {
        if (!draggingPageId || !dropHint) return;

        event.preventDefault();

        const draggedId = draggingPageId;
        const nextHint = dropHint;

        setDraggingPageId(null);
        setDropHint(null);

        void movePageByDrag(draggedId, node, nextHint.placement);
    };

    return (
        <aside className={`${styles.lnbWrap} ${mobileOverlay ? styles.overlayMode : ""}`} aria-label="Sidebar">
            {showTopRow && (
                <>
                    <div className={styles.topRow}>
                        <div className={styles.brand}>
                            <Button
                                className={styles.logoBtn}
                                variant="ghost"
                                size="s"
                                type="button"
                                onClick={() => go("home")}>
                                <Icon name="logo" source="url" basePath="/icons" size={40} />
                            </Button>
                        </div>
                    </div>

                    <Divider />
                </>
            )}

            <div className={styles.treeArea} aria-label="페이지 트리">
                {folders.filter((folder) => folder.id !== "pinned").map((folder) => (
                    <FolderNode
                        key={folder.id}
                        node={folder}
                        level={0}
                        activeKey={activeKey}
                        openFolderIds={openFolderIds}
                        onToggle={toggleFolder}
                        onAddChild={addChild}
                        onNavigate={(key) => go(key)}
                        onMoveToTrash={moveToTrash}
                        draggingPageId={draggingPageId}
                        dropHint={dropHint}
                        onDragStartPage={setDraggingPageId}
                        onDragEndPage={() => {
                            setDraggingPageId(null);
                            setDropHint(null);
                        }}
                        onDragOverPage={handleDragOverPage}
                        onDropPage={handleDropPage}
                    />
                ))}
            </div>

            <section className={styles.trashPane} aria-label="휴지통">
                <button
                    type="button"
                    className={`${styles.trashBlock} ${activeKey === "trash" ? styles.trashBlockActive : ""}`}
                    onClick={() => {
                        go("trash");
                        navigate("/delete");
                    }}
                >
                    <span className={styles.trashLeft}>
                        <span className={styles.trashIconSlot} aria-hidden="true">
                            <Icon name="trash" source="url" basePath="/icons" size={14} />
                        </span>
                        <span className={styles.trashTitle}>휴지통</span>
                    </span>
                </button>
            </section>
        </aside>
    );
}

export { Lnb };
