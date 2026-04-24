import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";

import styles from "./ConfirmHost.module.css";

/**
 * 전역 확인 모달을 표시합니다.
 * @returns 렌더링할 React 엘리먼트 또는 null을 반환합니다.
 */
function ConfirmHost(): React.ReactElement | null {
  const dispatch = useAppDispatch();
  const confirm = useAppSelector((state) => state.ui.confirm);

  useEffect(() => {
    if (!confirm.open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch(uiActions.closeConfirm());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm.open, dispatch]);

  if (!confirm.open) return null;

  return createPortal(
    <div className={styles.viewport} role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="닫기"
        onClick={() => dispatch(uiActions.closeConfirm())}
      />
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
      >
        <div className={styles.copy}>
          <h2 id="app-confirm-title" className={styles.title}>{confirm.title}</h2>
          <p id="app-confirm-message" className={styles.message}>{confirm.message}</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => dispatch(uiActions.closeConfirm())}
          >
            {confirm.cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmButton} ${confirm.danger ? styles.confirmButtonDanger : ""}`}
            onClick={() => {
              const handler = confirm.onConfirm;
              dispatch(uiActions.closeConfirm());
              handler();
            }}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { ConfirmHost };
