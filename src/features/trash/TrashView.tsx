/**
 * Trash View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { useAppDispatch } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";
import { DocumentCard } from "@features/document/index.ts";
import type { DocCardItem, DocCardPreviewItem } from "@features/document/model/document.types.ts";
import { DocumentsPageHeader } from "@features/document/ui/header/DocumentsPageHeader.tsx";
import type { DocumentsViewMode } from "@features/document/ui/tab/DocumentTab.types.ts";
import {
    fetchTrashDocumentsRemote,
    permanentDeletePageRemote,
    restorePageFromTrashRemote,
} from "@features/layout/state/layout.slice.ts";
import { selectTrashItems } from "@features/layout/state/layout.selector.ts";
import type { TrashItem } from "@features/layout/ui/lnb/Lnb.types.ts";

import styles from "./TrashView.module.css";

/**
 * 삭제 시각을 화면용 문자열로 변환합니다.
 *
 * @param ts 포맷할 삭제 시각 타임스탬프입니다.
 * @returns 사용자 화면에 표시할 날짜 문자열을 반환합니다.
 */
function formatDeletedAt(ts: number): string {
    return new Date(ts).toLocaleString();
}

function toTrashCardItem(item: TrashItem): DocCardItem {
    return {
        id: item.id,
        title: item.label,
        accent: "#D7D7D7",
        kind: "documents",
        createdAt: new Date(item.deletedAt).toISOString(),
    };
}

function toTrashPreview(item: TrashItem): DocCardPreviewItem[] {
    return [
        {
            blockType: "heading3",
            text: "휴지통에 보관된 문서",
        },
        {
            blockType: "paragraph",
            text: `삭제됨 ${formatDeletedAt(item.deletedAt)}`,
        },
    ];
}

/**
 * 휴지통 목록과 삭제 항목 상세 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function TrashView(): React.ReactElement {

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const trashItems = useSelector(selectTrashItems);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<DocumentsViewMode>("list");

    const refreshTrash = async (): Promise<void> => {
        setIsLoading(true);

        try {
            await dispatch(fetchTrashDocumentsRemote()).unwrap();
        } catch {
            // 휴지통 목록은 기존 상태를 유지하고, 빈 화면으로만 떨어지지 않게 합니다.
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let alive = true;

        async function loadTrash(): Promise<void> {
            try {
                await dispatch(fetchTrashDocumentsRemote()).unwrap();
            } catch {
                // 휴지통 목록은 기존 상태를 유지하고, 빈 화면으로만 떨어지지 않게 합니다.
            } finally {
                if (alive) setIsLoading(false);
            }
        }

        void loadTrash();

        return () => {
            alive = false;
        };
    }, [dispatch]);

    const trashCards = useMemo(
        () =>
            trashItems.map((item) => ({
                item,
                card: toTrashCardItem(item),
                preview: toTrashPreview(item),
            })),
        [trashItems]
    );

    const onRestore = async (pageId: string) => {
        try {
            await dispatch(restorePageFromTrashRemote({ pageId })).unwrap();
        } catch {
            return;
        }
        navigate(`/doc/${pageId}`);
    };

    const onPermanentDelete = async (pageId: string) => {
        try {
            await dispatch(permanentDeletePageRemote({ pageId })).unwrap();
        } catch {
            return;
        }
        await refreshTrash();
        navigate("/delete", { replace: true });
        dispatch(uiActions.showToast({ message: "완전 삭제되었습니다.", duration: 3000 }));
    };

    return (
        <div className={styles.page}>
            <DocumentsPageHeader
                title="휴지통"
                subtitle="5분 후 삭제됩니다"
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
            />

            <section className={styles.section} aria-label="삭제된 페이지 목록">
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>삭제된 문서</div>
                </div>
                <div className={viewMode === "list" ? styles.list : styles.cards}>
                    {isLoading ? (
                        <div className={styles.empty}>휴지통을 불러오는 중입니다.</div>
                    ) : trashItems.length === 0 ? (
                        <div className={styles.empty}>휴지통이 비어 있습니다.</div>
                    ) : (
                        trashCards.map(({ item, card, preview }) => (
                            <div
                                key={item.id}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    dispatch(
                                        uiActions.openContextMenu({
                                            x: event.clientX,
                                            y: event.clientY,
                                            items: [
                                                {
                                                    label: "복구",
                                                    onClick: () => {
                                                        void onRestore(item.id);
                                                    },
                                                },
                                                {
                                                    label: "완전 삭제",
                                                    onClick: () => {
                                                        dispatch(
                                                            uiActions.openConfirm({
                                                                title: "문서를 완전 삭제할까요?",
                                                                message: "삭제 후에는 복구할 수 없습니다.",
                                                                confirmLabel: "삭제",
                                                                cancelLabel: "취소",
                                                                danger: true,
                                                                onConfirm: () => {
                                                                    void onPermanentDelete(item.id);
                                                                },
                                                            })
                                                        );
                                                    },
                                                    danger: true,
                                                },
                                            ],
                                        })
                                    );
                                }}
                            >
                                <DocumentCard
                                    item={card}
                                    preview={preview}
                                    previewState="ready"
                                    variant={viewMode}
                                />
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

export { TrashView };
