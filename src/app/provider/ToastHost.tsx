import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";

import styles from "./ToastHost.module.css";

/**
 * 전역 토스트 메시지를 우측 하단에 표시합니다.
 * @returns 렌더링할 React 엘리먼트 또는 null을 반환합니다.
 */
function ToastHost(): React.ReactElement | null {
  const dispatch = useAppDispatch();
  const toast = useAppSelector((state) => state.ui.toast);

  useEffect(() => {
    if (!toast.open) return;

    const timer = window.setTimeout(() => {
      dispatch(uiActions.closeToast());
    }, toast.duration);

    return () => window.clearTimeout(timer);
  }, [dispatch, toast.duration, toast.id, toast.open]);

  if (!toast.open) return null;

  return createPortal(
    <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
      <div className={styles.toast} role="status">
        {toast.message}
      </div>
    </div>,
    document.body
  );
}

export { ToastHost };
