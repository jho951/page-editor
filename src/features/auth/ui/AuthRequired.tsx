/**
 * 로그인 여부에 따라 보호된 화면 접근을 제어합니다.
 */

import React from "react";
import { Button } from "@jho951/ui-components";
import { useI18n } from "@app/provider/useI18n.ts";
import { redirectToSsoStart } from "@features/auth/lib/authNavigation.ts";
import type { AuthRequiredProps } from "@features/auth/ui/AuthRequired.types.ts";
import styles from "@features/auth/ui/AuthRequired.module.css";

/**
 * 로그인 여부에 따라 보호된 화면 접근을 제어합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function AuthRequired({ nextPath, error }: AuthRequiredProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-label={t("auth.required.aria")}>
        <p className={styles.eyebrow}>{t("auth.required.eyebrow")}</p>
        <h1 className={styles.title}>{t("auth.required.title")}</h1>
        <p className={styles.desc}>
          {t("auth.required.description")}
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              redirectToSsoStart(nextPath, "assign");
            }}
          >
            {t("auth.required.button")}
          </Button>
        </div>
      </section>
    </div>
  );
}

export { AuthRequired };
