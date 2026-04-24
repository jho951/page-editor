/**
 * Home View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@jho951/ui-components";
import { useAppDispatch } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";

import { DocumentCard, documentsDomainApi, getAllDocs, replaceCatalog } from "@features/document/index.ts";
import { buildDocumentCardPreview } from "@features/document/lib/preview.ts";
import type { DocCardItem, DocCardPreviewItem } from "@features/document/model/document.types.ts";
import { DocumentsPageHeader } from "@features/document/ui/header/DocumentsPageHeader.tsx";
import type { DocumentsViewMode } from "@features/document/ui/tab/DocumentTab.types.ts";
import { createChildPage } from "@features/layout/index.ts";
import { movePageToTrashRemote } from "@features/layout/state/layout.slice.ts";

import styles from "./HomeView.module.css";

function toCardItem(id: string, title: string, createdAt?: string): DocCardItem {
    return {
        id,
        title,
        accent: "#D7D7D7",
        kind: "documents",
        createdAt,
    };
}

/**
 * 홈 화면의 최근 문서와 즐겨찾기 목록을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function HomeView(): React.ReactElement {

    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [catalogDocs, setCatalogDocs] = useState<DocCardItem[]>(() => getAllDocs());
    const [previewById, setPreviewById] = useState<Record<string, DocCardPreviewItem[]>>({});
    const [previewStateById, setPreviewStateById] = useState<Record<string, "loading" | "ready">>({});
    const [loading, setLoading] = useState<boolean>(catalogDocs.length === 0);
    const [viewMode, setViewMode] = useState<DocumentsViewMode>("grid");

    useEffect(() => {
        let cancelled = false;

        async function loadDocuments(): Promise<void> {
            setLoading(true);
            try {
                const documents = await documentsDomainApi.getDocuments();
                if (cancelled) return;

                const items = [...documents]
                    .sort((left, right) => {
                        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
                        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
                        return rightTime - leftTime;
                    })
                    .map((document) => toCardItem(document.id, document.title, document.createdAt));
                replaceCatalog("documents", items);
                setCatalogDocs(items);
            } catch {
                if (cancelled) return;
                setCatalogDocs(getAllDocs());
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadDocuments();
        return () => {
            cancelled = true;
        };
    }, []);

    const previewDocIds = catalogDocs.map((doc) => doc.id);

    useEffect(() => {
        const pendingIds = previewDocIds.filter((id) => previewStateById[id] == null);
        if (pendingIds.length === 0) return;

        let cancelled = false;

        setPreviewStateById((current) => ({
            ...current,
            ...Object.fromEntries(pendingIds.map((id) => [id, "loading" as const])),
        }));

        async function loadPreviews(): Promise<void> {
            const settled = await Promise.allSettled(
                pendingIds.map(async (documentId) => {
                    const blocks = await documentsDomainApi.getDocumentBlocks(documentId);
                    return {
                        documentId,
                        preview: buildDocumentCardPreview(blocks),
                    };
                })
            );

            if (cancelled) return;

            setPreviewById((current) => {
                const next = { ...current };

                settled.forEach((result, index) => {
                    const documentId = pendingIds[index];
                    next[documentId] = result.status === "fulfilled" ? result.value.preview : [];
                });

                return next;
            });

            setPreviewStateById((current) => ({
                ...current,
                ...Object.fromEntries(pendingIds.map((id) => [id, "ready" as const])),
            }));
        }

        void loadPreviews();
        return () => {
            cancelled = true;
        };
    }, [previewDocIds, previewStateById]);

    const onCreatePage = () => {
        dispatch(createChildPage({ parentId: "my" })).then((action) => {
            if (!createChildPage.fulfilled.match(action)) return;
            navigate(`/doc/${action.payload.documentId}`);
        });
    };

    const onCreateChildPage = (parentId: string) => {
        dispatch(createChildPage({ parentId })).then((action) => {
            if (!createChildPage.fulfilled.match(action)) return;
            navigate(`/doc/${action.payload.documentId}`);
        });
    };

    const onMoveToTrash = async (pageId: string) => {
        const action = await dispatch(movePageToTrashRemote({ pageId }));
        if (!movePageToTrashRemote.fulfilled.match(action)) return;

        setCatalogDocs((current) => current.filter((doc) => doc.id !== pageId));
        setPreviewById((current) => {
            const next = { ...current };
            delete next[pageId];
            return next;
        });
        setPreviewStateById((current) => {
            const next = { ...current };
            delete next[pageId];
            return next;
        });
    };

    const onDocumentContextMenu = (event: React.MouseEvent<HTMLDivElement>, doc: DocCardItem) => {
        event.preventDefault();
        event.stopPropagation();

        dispatch(
            uiActions.openContextMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                    {
                        label: "새 문서",
                        onClick: () => {
                            onCreateChildPage(doc.id);
                        },
                    },
                    {
                        label: "새 탭에서 열기",
                        onClick: () => {
                            window.open(`/doc/${doc.id}`, "_blank", "noopener,noreferrer");
                        },
                    },
                    {
                        label: "삭제",
                        onClick: () => {
                            void onMoveToTrash(doc.id);
                        },
                        danger: true,
                    },
                ],
            })
        );
    };

    return (
        <div className={styles.page}>
            <DocumentsPageHeader
                title="전체 문서"
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
            />

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>저장된 문서</div>
                    <button
                        type="button"
                        className={styles.addButton}
                        onClick={onCreatePage}
                        aria-label="새 문서 생성"
                        title="새 문서 생성"
                    >
                        <Icon name="plus" source="url" basePath="/icons" size={16} />
                    </button>
                </div>
                <div className={viewMode === "list" ? styles.list : styles.cards}>
                    {catalogDocs.map((doc) => (
                        <div key={doc.id} onContextMenu={(event) => onDocumentContextMenu(event, doc)}>
                            <DocumentCard
                                item={doc}
                                onClick={() => navigate(`/doc/${doc.id}`)}
                                preview={previewById[doc.id]}
                                previewState={previewStateById[doc.id] ?? "idle"}
                                variant={viewMode}
                            />
                        </div>
                    ))}
                    {catalogDocs.length === 0 && (
                        <div className={styles.empty}>
                            {loading ? "문서를 불러오는 중입니다." : "저장된 문서가 없습니다."}
                        </div>
                    )}
                </div>
            </section>

        </div>
    );
}

export { HomeView };
