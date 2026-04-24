/**
 * 로그인 여부에 따라 보호된 화면 접근을 제어합니다.
 */

import React from "react";
import { Button } from "@jho951/ui-components";
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
  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-label="로그인 필요">
        <p className={styles.eyebrow}>SSO Sign-In</p>
        <h1 className={styles.title}>로그인이 필요합니다.</h1>
        <p className={styles.desc}>
          시작 프론트에서 로그인을 시작하면 SSO 서버가 인증을 처리하고, 이 서비스는 발급된 세션만 사용합니다.
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
            SSO 로그인 시작
          </Button>
        </div>
      </section>
    </div>
  );
}

export { AuthRequired };
