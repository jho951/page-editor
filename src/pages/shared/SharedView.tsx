/**
 * Shared View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React from "react";
import { useI18n } from "@app/provider/useI18n.ts";

import styles from "./SharedView.module.css";

/**
 * 공유 문서 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function SharedView(): React.ReactElement {
    const { t } = useI18n();

    return (
        <section className={styles.page}>
            <article className={styles.hero}>
                <div className={styles.badge}>{t("shared.badge")}</div>
                <h1 className={styles.title}>{t("shared.title")}</h1>
                <p className={styles.desc}>
                    {t("shared.description")}
                </p>
            </article>

            <div className={styles.grid}>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>{t("shared.permissions.label")}</span>
                    <strong className={styles.panelValue}>{t("shared.permissions.value")}</strong>
                    <p className={styles.panelText}>{t("shared.permissions.text")}</p>
                </article>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>{t("shared.activity.label")}</span>
                    <strong className={styles.panelValue}>{t("shared.activity.value")}</strong>
                    <p className={styles.panelText}>{t("shared.activity.text")}</p>
                </article>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>{t("shared.participants.label")}</span>
                    <strong className={styles.panelValue}>{t("shared.participants.value")}</strong>
                    <p className={styles.panelText}>{t("shared.participants.text")}</p>
                </article>
            </div>
        </section>
    );
}

export { SharedView };
