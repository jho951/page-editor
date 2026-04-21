import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu } from "@jho951/ui-components";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";

/**
 * 전역 컨텍스트 메뉴를 표시하는 호스트 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function ContextMenuHost(): React.ReactElement | null {

  const dispatch = useAppDispatch();

  const menu = useAppSelector((s) => s.ui.contextMenu);

  const menuRef = useRef<HTMLDivElement>(null);

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
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
      />
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          zIndex: 1000,
          visibility: "hidden",
          minWidth: 160,
          background: "white",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: "1px solid #e5e7eb",
          padding: 6,
        }}
      >
        <Menu
          items={menu.items.map((item, index) => ({
            id: String(index),
            label: item.label,
            danger: item.danger,
            onSelect: () => {
              item.onClick();
              dispatch(uiActions.closeContextMenu());
            },
          }))}
          onRequestClose={() => dispatch(uiActions.closeContextMenu())}
        />
      </div>
    </>,
    document.body
  );
}

export { ContextMenuHost };
