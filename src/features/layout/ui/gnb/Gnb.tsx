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
  permanentDeletePageRemote,
  restorePageFromTrashRemote,
  togglePageShared,
} from "@features/layout/state/layout.slice.ts";
import { selectPinnedDocIds, selectSharedDocIds, selectTrashItems } from "@features/layout/state/layout.selector.ts";
import { logoutAuth } from "@features/auth/state/auth.slice.ts";

import { uiActions } from "@app/state/ui.slice.ts";

import { Button, Icon } from "@jho951/ui-components";

import styles from "./Gnb.module.css";

type HeaderMode = "default" | "docText" | "deleteDetail";

/**
 * 상단 글로벌 내비게이션 바를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function Gnb({ profile }: GnbProps): React.ReactElement {
  const { id } = useParams<{ id: string }>();

  const location = useLocation();

  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const isDocRoute = location.pathname.startsWith("/doc/");

  const isDeleteDetailRoute = location.pathname.startsWith("/delete/");

  const pinnedDocIds = useSelector(selectPinnedDocIds);

  const sharedDocIds = useSelector(selectSharedDocIds);

  const trashItems = useSelector(selectTrashItems);

  const isPinned = id && isDocRoute ? pinnedDocIds.includes(id) : false;

  const isShared = id && isDocRoute ? sharedDocIds.includes(id) : false;

  const onTogglePinned = useCallback(() => {
    if (!id || !isDocRoute) return;
    dispatch(layoutActions.togglePinned(id));
  }, [dispatch, id, isDocRoute]);

  const onMoveToTrash = useCallback(() => {
    if (!id || !isDocRoute) return;
    void dispatch(movePageToTrashRemote({ pageId: id }));
    navigate("/");
  }, [dispatch, id, isDocRoute, navigate]);

  const onToggleShare = useCallback(() => {
    if (!id || !isDocRoute) return;
    dispatch(togglePageShared({ docId: id }));
  }, [dispatch, id, isDocRoute]);

  const onOpenProfileMenu = useCallback(
    (e: React.MouseEvent) => {

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dispatch(
        uiActions.openContextMenu({
          x: rect.right,
          y: rect.bottom + 8,
          items: [
            { label: "이름 바꾸기", onClick: () => console.log("Rename") },
            { label: "로그아웃", onClick: () => void dispatch(logoutAuth()), danger: true },
          ],
        })
      );
    },
    [dispatch]
  );

  const onBackToTrashList = useCallback(() => {
    navigate("/delete");
  }, [navigate]);

  const onRestoreFromTrash = useCallback(() => {
    if (!id || !isDeleteDetailRoute) return;
    void dispatch(restorePageFromTrashRemote({ pageId: id }));
    navigate(`/doc/${id}`);
  }, [dispatch, id, isDeleteDetailRoute, navigate]);

  const onPermanentDeleteFromTrash = useCallback(() => {
    if (!id || !isDeleteDetailRoute) return;

    const remain = trashItems.filter((item) => item.id !== id);
    void dispatch(permanentDeletePageRemote({ pageId: id }));
    if (remain.length > 0) {
      navigate(`/delete/${remain[0].id}`, { replace: true });
      return;
    }
    navigate("/delete", { replace: true });
  }, [dispatch, id, isDeleteDetailRoute, navigate, trashItems]);

  const headerMode: HeaderMode = (() => {
    if (id && isDeleteDetailRoute) return "deleteDetail";
    if (id && isDocRoute) return "docText";
    return "default";
  })();

  return (
    <header className={styles.gnbWrap} aria-label="Top bar">
      <div className={styles.gnbLeft}>
        {headerMode === "deleteDetail" && (
          <Button
            type="button"
            variant="ghost"
            size="s"
            className={styles.backIconBtn}
            onClick={onBackToTrashList}
            title="목록으로"
            aria-label="목록으로"
          >
            <span className={styles.backIcon} aria-hidden="true">←</span>
          </Button>
        )}
        {headerMode === "docText" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.favoriteBtn} ${isPinned ? styles.active : ""}`}
              onClick={onTogglePinned}
              title={isPinned ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            >
              <Icon name="star" size={22} />
            </Button>
          </>
        )}
      </div>

      <div className={styles.gnbRight}>
        {headerMode === "docText" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.shareBtn} ${isShared ? styles.shareBtnActive : ""}`}
              onClick={onToggleShare}
              title={isShared ? "공유 해제" : "공유 활성화"}
              aria-pressed={isShared}
            >
              <Icon name="share" source="url" basePath="/icons" size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={styles.trashBtn}
              onClick={onMoveToTrash}
              title="휴지통으로 이동"
              aria-label="휴지통으로 이동"
            >
              <Icon name="trash" source="url" basePath="/icons" size={16} />
            </Button>
          </>
        )}
        {headerMode === "deleteDetail" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={styles.deleteActionBtn}
              onClick={onPermanentDeleteFromTrash}
            >
              완전 삭제
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={styles.deleteActionBtn}
              onClick={onRestoreFromTrash}
            >
              복구
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
