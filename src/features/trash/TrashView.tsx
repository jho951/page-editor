/**
 * Trash View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@app/provider/useI18n.ts";
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
function toTrashCardItem(item: TrashItem): DocCardItem {
    return {
        id: item.id,
        title: item.label,
        accent: "#ffd0c8",
        kind: "documents",
        createdAt: new Date(item.deletedAt).toISOString(),
    };
}

function toTrashPreview(heading: string, deletedAtText: string): DocCardPreviewItem[] {
    return [
        {
            blockType: "heading3",
            text: heading,
        },
        {
            blockType: "paragraph",
            text: deletedAtText,
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
    const { formatDateTime, t } = useI18n();

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
                preview: toTrashPreview(
                    t("trash.preview.heading"),
                    t("trash.preview.deletedAt", { date: formatDateTime(item.deletedAt) }),
                ),
            })),
        [formatDateTime, t, trashItems]
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
        dispatch(uiActions.showToast({ message: t("trash.toast.deleted"), duration: 3000 }));
    };

    return (
        <div className={styles.page}>
            <DocumentsPageHeader
                title={t("trash.title")}
                subtitle={t("trash.subtitle")}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
            />

            <section className={styles.section} aria-label={t("trash.section.title")}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>{t("trash.section.title")}</div>
                </div>
                <div className={viewMode === "list" ? styles.list : styles.cards}>
                    {isLoading ? (
                        <div className={styles.empty}>{t("trash.loading")}</div>
                    ) : trashItems.length === 0 ? (
                        <div className={styles.empty}>{t("trash.empty")}</div>
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
                                                    label: t("common.actions.restore"),
                                                    onClick: () => {
                                                        void onRestore(item.id);
                                                    },
                                                },
                                                {
                                                    label: t("common.actions.delete"),
                                                    onClick: () => {
                                                        dispatch(
                                                            uiActions.openConfirm({
                                                                title: t("trash.confirm.title"),
                                                                message: t("trash.confirm.message"),
                                                                confirmLabel: t("trash.confirm.confirmLabel"),
                                                                cancelLabel: t("common.actions.cancel"),
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
