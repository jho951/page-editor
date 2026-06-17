import React from "react";
import { useI18n } from "@app/provider/useI18n.ts";

import type { DocumentsViewMode } from "@features/document/ui/tab/DocumentTab.types.ts";

import styles from "./DocumentsPageHeader.module.css";

type DocumentsPageHeaderProps = {
    title: string;
    subtitle?: string;
    viewMode: DocumentsViewMode;
    onChangeViewMode: (next: DocumentsViewMode) => void;
};

function DocumentsPageHeader({
    title,
    subtitle,
    viewMode,
    onChangeViewMode,
}: DocumentsPageHeaderProps): React.ReactElement {
    const { t } = useI18n();

    return (
        <header className={styles.header}>
            <div className={styles.titleWrap}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            <div className={styles.headerActions}>
                <div className={styles.viewToggle} role="group" aria-label={t("common.view.modeAria", { title })}>
                    <button
                        type="button"
                        className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.viewToggleButtonActive : ""}`}
                        onClick={() => onChangeViewMode("list")}
                        aria-pressed={viewMode === "list"}
                        title={t("common.view.listTitle")}
                    >
                        <span className={`${styles.toggleIcon} ${styles.toggleIconList}`} aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`${styles.viewToggleButton} ${viewMode === "grid" ? styles.viewToggleButtonActive : ""}`}
                        onClick={() => onChangeViewMode("grid")}
                        aria-pressed={viewMode === "grid"}
                        title={t("common.view.gridTitle")}
                    >
                        <span className={`${styles.toggleIcon} ${styles.toggleIconGrid}`} aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}

export { DocumentsPageHeader };
