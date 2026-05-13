/**
 * 문서 목록 화면을 조합하는 뷰 컴포넌트입니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DocumentGrid } from "@features/document/ui/grid/DocumentGrid.tsx";
import { fetchCatalog } from "@features/document/api/catalog.ts";
import type { DocCardItem } from "@features/document/model/document.types.ts";
import type { DocumentCatalogViewProps } from "@features/document/ui/catalog/DocumentCatalogView.types.ts";
import type { DocumentsViewMode } from "@features/document/ui/tab/DocumentTab.types.ts";
import { DocumentPageHeader } from "@features/document/ui/shell/index.ts";

import shellStyles from "@features/document/ui/shell/DocumentPageShell.module.css";
import styles from "./DocumentCatalogView.module.css";

/**
 * 문서 목록 화면의 필터와 카드 목록을 조합합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentCatalogView({ mode = "documents" }: DocumentCatalogViewProps): React.ReactElement {

    const navigate = useNavigate();
    const [query, setQuery] = useState<string>("");
    const [viewMode, setViewMode] = useState<DocumentsViewMode>("grid");
    const [baseItems, setBaseItems] = useState<DocCardItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [source, setSource] = useState<"local" | "remote">("local");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load(): Promise<void> {
            setLoading(true);
            setError(null);
            try {

                const result = await fetchCatalog(mode);
                if (cancelled) return;
                setBaseItems(result.items);
                setSource(result.source);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "catalog load failed");
                setBaseItems([]);
                setSource("local");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [mode]);

    const items = useMemo<DocCardItem[]>(() => {

        const q = query.trim().toLowerCase();
        if (!q) return baseItems;
        return baseItems.filter((item) => item.title.toLowerCase().includes(q));
    }, [baseItems, query]);

    return (
        <div className={shellStyles.content}>
            <DocumentPageHeader
                eyebrow="문서함"
                title="문서 라이브러리"
                lead="최근 문서와 저장된 문서를 한곳에서 보고, 정렬하고, 바로 편집하세요."
                actions={
                    <>
                        <label className={styles.searchField}>
                            <input
                                className={styles.searchInput}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="문서 검색"
                                aria-label="문서 검색"
                            />
                            <span className={styles.searchIcon} aria-hidden="true">
                                <span className={styles.searchLens} />
                            </span>
                        </label>

                        <div className={styles.viewToggle} role="group" aria-label="View mode">
                            <button
                                type="button"
                                className={`${styles.viewButton} ${viewMode === "grid" ? styles.viewButtonActive : ""}`}
                                onClick={() => setViewMode("grid")}
                            >
                                카드
                            </button>
                            <button
                                type="button"
                                className={`${styles.viewButton} ${viewMode === "list" ? styles.viewButtonActive : ""}`}
                                onClick={() => setViewMode("list")}
                            >
                                리스트
                            </button>
                        </div>

                        <button className={styles.iconBtn} type="button" aria-label="Sort">
                            최신순
                        </button>
                    </>
                }
                meta={
                    <>
                        <div className={shellStyles.metaChip}>Collections</div>
                        <div className={shellStyles.metaChip}>{items.length}개 문서</div>
                    </>
                }
            />
            <div className={shellStyles.statusRow} aria-live="polite">
                {loading ? "문서 목록 불러오는 중..." : source === "remote" ? "API 문서 목록 사용 중" : "로컬 카탈로그 사용 중"}
                {error ? ` · ${error}` : ""}
            </div>

            <div className={shellStyles.surfacePanel}>
                <DocumentGrid items={items} variant={viewMode} onItemClick={(id) => navigate(`/doc/${id}`)} />
            </div>
        </div>
    );
}

export { DocumentCatalogView };
