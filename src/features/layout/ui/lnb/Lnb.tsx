/**
 * 왼쪽 탐색 영역 전체를 렌더링합니다.
 */

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "@app/store/store.ts";
import { useNavigate } from "react-router-dom";

import { createChildPage, fetchLnbDocuments, layoutActions, movePageToTrashRemote } from "@features/layout/state/layout.slice.ts";
import { selectAuthInitialized, selectIsAuthenticated } from "@features/auth/index.ts";
import type { LnbActiveKey, LnbProps } from "@features/layout/ui/lnb/Lnb.types.ts";
import { selectFolders, selectLnbOpenFolderIds } from "@features/layout/state/layout.selector.ts";
import { FolderNode } from "@features/layout/ui/lnb/FolderNode.tsx";

import { Button, Divider, Icon } from "@jho951/ui-components";

import styles from "./Lnb.module.css";

/**
 * 왼쪽 탐색 영역과 페이지 트리를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function Lnb({ activeKey = "home", onNavigate }: LnbProps) {

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

    return (
        <aside className={styles.lnbWrap} aria-label="Sidebar">
            <div className={styles.topRow}>
                <Button
                    className={styles.logoBtn}
                    variant="ghost"
                    size="s"
                    type="button"
                    onClick={() => go("home")}>
                    <Icon name="logo" source="url" basePath="/icons" size={40} />
                </Button>
            </div>

            <Divider />

            <div className={styles.treeArea} aria-label="페이지 트리">
                {folders.map((folder) => (
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
