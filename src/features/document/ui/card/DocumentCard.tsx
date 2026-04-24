/**
 * 문서 카드 하나의 표시와 클릭 동작을 담당합니다.
 */

import React, { useRef } from "react";
import type {DocumentCardProps} from "@features/document/ui/card/DocumentCard.types.ts";

import { Button } from "@jho951/ui-components";

import styles from "./DocumentCard.module.css";

function formatCreatedAt(createdAt: string | null | undefined): string {
    if (!createdAt) return "문서";

    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) return "문서";

    const year = String(parsed.getFullYear());
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
}

function previewClassName(blockType: "paragraph" | "heading1" | "heading2" | "heading3"): string {
    switch (blockType) {
        case "heading1":
            return styles.previewHeading1;
        case "heading2":
            return styles.previewHeading2;
        case "heading3":
            return styles.previewHeading3;
        case "paragraph":
        default:
            return styles.previewParagraph;
    }
}

/**
 * 문서 카드 한 건을 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentCard({ item, onClick, variant = "grid", preview, previewState = "idle" }: DocumentCardProps): React.ReactElement {

    const startPos = useRef({ x: 0, y: 0 });

    const hasPreview = previewState === "ready" && Array.isArray(preview) && preview.length > 0;
    const showEmptyPreview = previewState === "ready" && (!preview || preview.length === 0);

    return (
        <Button
            type="button"
            className={variant === "list" ? styles.cardList : styles.card}
            onPointerDown={(e) => {
                startPos.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {

                const diffX = Math.abs(e.clientX - startPos.current.x);

                const diffY = Math.abs(e.clientY - startPos.current.y);
                if (diffX < 5 && diffY < 5) onClick?.(item.id);
            }}
        >
            <div
                className={styles.cardFrame}
                style={{ "--accent": item.accent } as React.CSSProperties}
            >
                <div className={styles.cardTop}>
                    <div className={styles.titleArea}>
                        <div className={styles.cardTitle}>{item.title}</div>
                        <div className={styles.subTitle}>{formatCreatedAt(item.createdAt)}</div>
                    </div>
                </div>

                <div className={styles.preview}>
                    {hasPreview ? (
                        <div className={styles.previewContent}>
                            {preview.map((previewItem, index) => (
                                <div
                                    key={`${item.id}-preview-${index}`}
                                    className={`${styles.previewItem} ${previewClassName(previewItem.blockType)}`}
                                >
                                    {previewItem.text}
                                </div>
                            ))}
                        </div>
                    ) : showEmptyPreview ? (
                        <div className={styles.previewEmpty}>본문 미리보기가 없습니다.</div>
                    ) : (
                        <div className={styles.skeleton}>
                            <div className={styles.previewLine} />
                            <div className={styles.previewLine} />
                            <div className={styles.previewLineShort} />
                        </div>
                    )}
                </div>

                <div className={styles.accentBar} />
            </div>
        </Button>
    );
}

export { DocumentCard };
