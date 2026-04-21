/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@jho951/ui-components";

import { useAppDispatch } from "@app/store/hooks.ts";
import { BlockEditor } from "@features/editor/index.ts";
import { upsertCatalogItem } from "@features/document/lib/catalog.ts";
import { pagesApi } from "@features/layout/api/pages.ts";
import { layoutActions } from "@features/layout/index.ts";

import styles from "./DocumentDetailView.module.css";

/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentDetailView(): React.ReactElement {
    const { id } = useParams<{ id: string }>();

    const navigate = useNavigate();

    const dispatch = useAppDispatch();

    const [docTitle, setDocTitle] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(id));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setDocTitle(null);
            setLoading(false);
            setError("문서 ID가 없습니다.");
            return;
        }

        let cancelled = false;

        const loadDocument = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await pagesApi.getPage(id);
                if (cancelled) return;

                const nextTitle = response.title?.trim() || "Untitled";
                setDocTitle(nextTitle);
                upsertCatalogItem({
                    id: response.id,
                    title: nextTitle,
                    accent: "#D7D7D7",
                    kind: "documents",
                });
            } catch (loadError) {
                if (cancelled) return;

                setError(loadError instanceof Error ? loadError.message : "문서를 불러오지 못했습니다.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadDocument();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        if (!id) return;
        dispatch(layoutActions.recordRecent(id));
        dispatch(layoutActions.setLastLocation({ docId: id }));
    }, [dispatch, id]);

    if (!id) {
        return (
            <section className={styles.content}>
                <div className={styles.headerRow}>
                    <div className={styles.headerCopy}>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.pageEyebrow}>문서 없음</div>
                            <div className={styles.tab}>
                                <h1 className={styles.tabIcon}>문서를 찾을 수 없습니다.</h1>
                            </div>
                        </div>
                        <p className={styles.headerLead}>링크가 만료되었거나 문서가 아직 준비되지 않았습니다.</p>
                    </div>
                </div>
                <div className={`${styles.surfacePanel} ${styles.emptyState}`}>
                    <div className={styles.statusRow}>문서가 존재하지 않거나 아직 불러오지 못했습니다.</div>
                    <Button type="button" variant="ghost" onClick={() => navigate("/documents")}>
                        문서 목록으로 이동
                    </Button>
                </div>
            </section>
        );
    }

    if (loading && !docTitle) {
        return (
            <section className={styles.content}>
                <div className={styles.headerRow}>
                    <div className={styles.headerCopy}>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.pageEyebrow}>불러오는 중</div>
                            <div className={styles.tab}>
                                <h1 className={styles.tabIcon}>문서를 불러오는 중입니다.</h1>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={`${styles.surfacePanel} ${styles.emptyState}`}>
                    <div className={styles.statusRow}>GET /v1/documents/{id} 요청으로 상세 정보를 가져오는 중입니다.</div>
                </div>
            </section>
        );
    }

    if (error && !docTitle) {
        return (
            <section className={styles.content}>
                <div className={styles.headerRow}>
                    <div className={styles.headerCopy}>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.pageEyebrow}>문서 없음</div>
                            <div className={styles.tab}>
                                <h1 className={styles.tabIcon}>문서를 찾을 수 없습니다.</h1>
                            </div>
                        </div>
                        <p className={styles.headerLead}>{error}</p>
                    </div>
                </div>
                <div className={`${styles.surfacePanel} ${styles.emptyState}`}>
                    <div className={styles.statusRow}>{error}</div>
                    <Button type="button" variant="ghost" onClick={() => navigate("/documents")}>
                        문서 목록으로 이동
                    </Button>
                </div>
            </section>
        );
    }

    const doc = {
        id,
        title: docTitle ?? "Untitled",
        kind: "documents" as const,
        accent: "#D7D7D7",
    };

    return (
        <section className={styles.content}>
            <div className={styles.headerRow}>
                <div className={styles.headerCopy}>
                    <div className={styles.headerTitleGroup}>
                        <div className={styles.pageEyebrow}>편집 중</div>
                        <div className={styles.tab}>
                            <h1 className={styles.tabIcon}>{doc.title}</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.headerMeta}>
                <div className={styles.yearLabel}>문서 편집기</div>
                <div className={styles.yearLabel}>저장 준비</div>
            </div>

            <div className={styles.infoGrid}>
                <div className={styles.infoCard}>
                    <span className={styles.infoLabel}>문서 ID</span>
                    <p className={styles.infoValue}>{doc.id}</p>
                </div>
                <div className={styles.infoCard}>
                    <span className={styles.infoLabel}>분류</span>
                    <p className={styles.infoValue}>{doc.kind}</p>
                </div>
                <div className={styles.infoCard}>
                    <span className={styles.infoLabel}>색상</span>
                    <p className={styles.infoValue}>{doc.accent}</p>
                </div>
            </div>

            <div className={`${styles.surfacePanel} ${styles.editorShell}`}>
                <BlockEditor documentId={doc.id} />
            </div>
        </section>
    );
}

export { DocumentDetailView };
