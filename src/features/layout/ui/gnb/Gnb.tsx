/**
 * 상단 글로벌 내비게이션 UI를 렌더링합니다.
 */

import React, { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAppDispatch } from "@app/store/hooks.ts";

import type { GnbProps } from "@features/layout/ui/gnb/Gnb.types.ts";
import {
  layoutActions,
  movePageToTrashRemote,
} from "@features/layout/state/layout.slice.ts";
import { selectPinnedDocIds } from "@features/layout/state/layout.selector.ts";
import { buildStartFrontendRootUrl } from "@features/auth/index.ts";
import { logoutAuth } from "@features/auth/state/auth.slice.ts";

import { uiActions } from "@app/state/ui.slice.ts";

import { Button, Icon } from "@jho951/ui-components";

import styles from "./Gnb.module.css";

type HeaderMode = "default" | "docText";

/**
 * 상단 글로벌 내비게이션 바를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function Gnb({ profile, onOpenMobileMenu }: GnbProps): React.ReactElement {
  const { id } = useParams<{ id: string }>();

  const location = useLocation();

  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const isDocRoute = location.pathname.startsWith("/doc/");

  const pinnedDocIds = useSelector(selectPinnedDocIds);

  const isPinned = id && isDocRoute ? pinnedDocIds.includes(id) : false;

  const onTogglePinned = useCallback(() => {
    if (!id || !isDocRoute) return;
    dispatch(layoutActions.togglePinned(id));
  }, [dispatch, id, isDocRoute]);

  const onMoveToTrash = useCallback(async () => {
    if (!id || !isDocRoute) return;
    try {
      await dispatch(movePageToTrashRemote({ pageId: id })).unwrap();
    } catch {
      return;
    }
    navigate("/");
  }, [dispatch, id, isDocRoute, navigate]);

  const onLogout = useCallback(() => {
    const redirectUrl = buildStartFrontendRootUrl();

    void dispatch(logoutAuth())
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        if (typeof window !== "undefined") {
          window.location.replace(redirectUrl);
        }
      });
  }, [dispatch]);

  const onOpenProfileMenu = useCallback(
    (e: React.MouseEvent) => {

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dispatch(
        uiActions.openContextMenu({
          x: rect.right,
          y: rect.bottom + 8,
          items: [
            { label: "로그아웃", onClick: onLogout, danger: true },
          ],
        })
      );
    },
    [dispatch, onLogout]
  );

  const headerMode: HeaderMode = (() => {
    if (id && isDocRoute) return "docText";
    return "default";
  })();

    return (
    <header className={styles.gnbWrap} aria-label="Top bar">
      <div className={styles.gnbLeft}>
        <Button
          type="button"
          variant="ghost"
          size="s"
          className={styles.mobileLogoBtn}
          onClick={onOpenMobileMenu}
          aria-label="메뉴 열기"
        >
          <Icon name="logo" source="url" basePath="/icons" size={40} />
        </Button>
      </div>

      <div className={styles.gnbRight}>
        {headerMode === "docText" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.iconActionBtn} ${styles.favoriteBtn} ${isPinned ? styles.favoriteBtnActive : ""}`}
              onClick={onTogglePinned}
              title={isPinned ? "즐겨찾기 해제" : "즐겨찾기 추가"}
              aria-pressed={isPinned}
            >
              <Icon name="star" size={22} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.iconActionBtn} ${styles.trashBtn}`}
              onClick={onMoveToTrash}
              title="휴지통으로 이동"
              aria-label="휴지통으로 이동"
            >
              <Icon name="trash" source="url" basePath="/icons" size={19} />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="s"
          className={styles.menuBtn}
          onClick={onOpenProfileMenu}
          aria-label="Open profile menu"
        >
          <span className={styles.avatar} aria-hidden="true">
            {String(profile).slice(0, 1).toUpperCase()}
          </span>
        </Button>
      </div>
    </header>
  );
}

export { Gnb };
