import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";
import styles from "./ContextMenuHost.module.css";

/**
 * 전역 컨텍스트 메뉴를 표시하는 호스트 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function ContextMenuHost(): React.ReactElement | null {

  const dispatch = useAppDispatch();

  const menu = useAppSelector((s) => s.ui.contextMenu);

  const menuRef = useRef<HTMLDivElement>(null);

  const groups = React.useMemo(() => {
    if (!menu.open) return [];

    const first: typeof menu.items = [];
    const middle: typeof menu.items = [];
    const danger: typeof menu.items = [];

    menu.items.forEach((item, index) => {
      if (item.danger) {
        danger.push(item);
        return;
      }

      if (index === 0 && /새 탭/.test(item.label)) {
        first.push(item);
        return;
      }

      middle.push(item);
    });

    return [first, middle, danger].filter((group) => group.length > 0);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu.open || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();

    const screenW = window.innerWidth;

    const screenH = window.innerHeight;
    let x = menu.x - rect.width;
    let y = menu.y;

    if (x < 12) x = 12;
    if (x + rect.width > screenW) x = screenW - rect.width - 12;
    if (y + rect.height > screenH) y = screenH - rect.height - 12;

    menuRef.current.style.left = `${x}px`;
    menuRef.current.style.top = `${y}px`;
    menuRef.current.style.visibility = "visible";
  }, [menu]);

  if (!menu.open) return null;

  return createPortal(
    <>
      <div
        onClick={() => dispatch(uiActions.closeContextMenu())}
        className={styles.backdrop}
      />
      <div
        ref={menuRef}
        className={styles.menu}
      >
        <div role="menu" className={styles.content}>
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} role="group" className={styles.group}>
              {group.map((item, itemIndex) => (
                <button
                  key={`${item.label}-${itemIndex}`}
                  type="button"
                  role="menuitem"
                  className={`${styles.item} ${item.danger ? styles.itemDanger : ""}`}
                  onClick={() => {
                    item.onClick();
                    dispatch(uiActions.closeContextMenu());
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

export { ContextMenuHost };
