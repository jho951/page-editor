/**
 * Document Tab UI 컴포넌트입니다.
 */

import React from "react";
import { Switch } from "@jho951/ui-components";
import { useI18n } from "@app/provider/useI18n.ts";

import type {DocumentTabSwitchProps} from "@features/document/ui/tab/DocumentTab.types.ts";

import styles from "@features/document/ui/tab/DocumentTab.module.css";

/**
 * 문서 목록 탭 전환 UI를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentTab({ value, onChange }: DocumentTabSwitchProps): React.ReactElement {
    const { t } = useI18n();

    const isList = value === "list";

    return (
        <div className={styles.documentSwitch} aria-label={t("document.tab.aria")}>
            <div className={styles.documentLabel}>
                <span className={styles.documentIcon}>{isList ? "📃" : "🟦"}</span>
                <span className={styles.documentText}>{isList ? t("document.tab.list") : t("document.tab.grid")}</span>
            </div>

            <Switch
                checked={isList}
                onChange={(checked) => onChange(checked ? "list" : "grid")}
                label={t("document.tab.switchLabel")}
                aria-label={t("document.tab.toggleAria")}
            />
        </div>
    );
}

export{DocumentTab}
