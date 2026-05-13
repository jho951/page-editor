/**
 * Home View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React, { useDeferredValue, useEffect, useState } from "react";
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

const DOC_ACCENTS = ["#b7ccff", "#c9d8ff", "#d6e3ff", "#a9c4ff"];

function toCardItem(id: string, title: string, createdAt?: string, index = 0): DocCardItem {
    return {
        id,
        title,
        accent: DOC_ACCENTS[index % DOC_ACCENTS.length],
        kind: "documents",
        createdAt,
    };
}

function buildSpotlightPreview(preview?: DocCardPreviewItem[]): string {
    const text = (preview ?? [])
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(" ");

    if (!text) {
        return "아직 본문 미리보기가 없습니다. 새 문서를 만들어 첫 아이디어를 적어보세요.";
    }

    return text.length > 144 ? `${text.slice(0, 144).trim()}...` : text;
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
    const [searchQuery, setSearchQuery] = useState("");

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
                    .map((document, index) => toCardItem(document.id, document.title, document.createdAt, index));
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
    const deferredSearchQuery = useDeferredValue(searchQuery);

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

    const normalizedSearch = deferredSearchQuery.trim().toLocaleLowerCase();

    const filteredDocs = normalizedSearch
        ? catalogDocs.filter((doc) => {
            const previewText = (previewById[doc.id] ?? [])
                .map((item) => item.text)
                .join(" ")
                .toLocaleLowerCase();

            return doc.title.toLocaleLowerCase().includes(normalizedSearch) || previewText.includes(normalizedSearch);
        })
        : catalogDocs;

    const spotlightDoc = filteredDocs[0] ?? catalogDocs[0] ?? null;
    const spotlightPreview = spotlightDoc ? buildSpotlightPreview(previewById[spotlightDoc.id]) : "문서를 불러오면 가장 최근 작업이 이곳에 표시됩니다.";
    const activeViewLabel = viewMode === "grid" ? "카드 뷰" : "리스트 뷰";

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
                title="안녕하세요."
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
            />

            <section className={styles.spotlight}>
                <div className={styles.spotlightContent}>
                    <span className={styles.kicker}>Spotlight</span>
                    <h3 className={styles.spotlightTitle}>
                        {spotlightDoc ? spotlightDoc.title : "새 문서에서 작업을 시작해 보세요."}
                    </h3>
                    <p className={styles.spotlightText}>{spotlightPreview}</p>
                </div>
                <div className={styles.spotlightActions}>
                    <button
                        type="button"
                        className={styles.spotlightPrimary}
                        onClick={() => {
                            if (spotlightDoc) {
                                navigate(`/doc/${spotlightDoc.id}`);
                                return;
                            }
                            onCreatePage();
                        }}
                    >
                        {spotlightDoc ? "최근 문서 열기" : "첫 문서 만들기"}
                    </button>
                    <button type="button" className={styles.spotlightSecondary} onClick={onCreatePage}>
                        새 초안 추가
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionHeaderLeft}>
                        <div>
                            <div className={styles.sectionEyebrow}>Document Catalog</div>
                            <div className={styles.sectionTitle}>저장된 문서</div>
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.metaPill}>
                                {filteredDocs.length.toLocaleString("ko-KR")}개 표시
                            </span>
                            <span className={styles.metaPill}>{activeViewLabel}</span>
                        </div>
                    </div>
                    <div className={styles.sectionActions}>
                        {searchQuery.trim() ? (
                            <button
                                type="button"
                                className={styles.clearButton}
                                onClick={() => setSearchQuery("")}
                            >
                                검색 지우기
                            </button>
                        ) : null}
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
                </div>
                <div className={viewMode === "list" ? styles.list : styles.cards}>
                    {filteredDocs.map((doc) => (
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
                    {filteredDocs.length === 0 && (
                        <div className={styles.empty}>
                            {loading
                                ? "문서를 불러오는 중입니다."
                                : searchQuery.trim()
                                  ? "검색 결과가 없습니다."
                                  : "저장된 문서가 없습니다."}
                        </div>
                    )}
                </div>
            </section>

        </div>
    );
}

export { HomeView };
