/**
 * LNB 안의 폴더 또는 문서 노드 하나를 렌더링합니다.
 */

import React from "react";
import { Icon } from "@jho951/ui-components";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@app/store/hooks.ts";
import { uiActions } from "@app/state/ui.slice.ts";
import type { FolderItem, LnbActiveKey } from "@features/layout/ui/lnb/Lnb.types.ts";
import type { FolderNodeProps } from "@features/layout/ui/lnb/FolderNode.types.ts";
import styles from "@features/layout/ui/lnb/FolderNode.module.css";

/**
 * 아이콘 이름이 없을 때 사용할 기본 아이콘을 반환합니다.
 *
 * @param name 검사할 아이콘 이름입니다.
 * @returns 문자열 결과를 반환합니다.
 */
function iconFallback(name: string): string {
  if (name === "logo") return "⌂";
  if (name === "document") return "•";
  if (name === "star") return "★";
  if (name === "users") return "◎";
  if (name === "allDocs") return "▣";
  if (name === "folder") return "◧";
  return "•";
}

/**
 * 노드 유형에 맞는 아이콘 이름을 계산합니다.
 *
 * @param node 아이콘을 계산할 폴더 또는 페이지 노드입니다.
 * @returns 문자열 결과를 반환합니다.
 */
function resolveIconName(node: FolderItem): string {
  if (node.icon) return node.icon;
  if (node.key === "allDocs") return "document";
  if (node.key === "shared") return "users";
  if (node.key === "home") return "logo";
  if (node.id === "my") return "allDocs";
  if (node.id === "pinned") return "star";
  if (node.id === "sharedRoot") return "users";
  return "document";
}

/**
 * LNB 안의 폴더 또는 문서 노드 하나를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function FolderNode({
  node,
  level,
  activeKey,
  openFolderIds,
  onToggle,
  onNavigate,
  onAddChild,
  onMoveToTrash,
  draggingPageId,
  dropHint,
  onDragStartPage,
  onDragEndPage,
  onDragOverPage,
  onDropPage,
}: FolderNodeProps): React.ReactElement {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const isSection = level === 0;

  const isOpen = !!openFolderIds[node.id];

  const hasChildren = !!node.children?.length;

  const myKey = (node.key ?? (`folder:${node.id}` as const)) as LnbActiveKey;

  const isActive = activeKey === myKey;

  const iconName = resolveIconName(node);

  const isPersonalSection = isSection && node.id === "my";

  const isPageNode = !isSection && !!node.key;

  const showChevron = isSection || hasChildren;

  const canAddChild = isPersonalSection || isPageNode;
  const pageId = node.docId ?? node.id;
  const isDragging = draggingPageId === pageId;
  const isDropBefore = dropHint?.targetId === pageId && dropHint.placement === "before";
  const isDropAfter = dropHint?.targetId === pageId && dropHint.placement === "after";
  const isDropInside = dropHint?.targetId === pageId && dropHint.placement === "inside";

  const onRowClick = () => {
    if (isSection) {
      onToggle(node.id);
      return;
    }
    if (node.key) onNavigate?.(node.key);
  };

  const onRowContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const pagePath = `/doc/${pageId}`;
    const items: Array<{
      label: string;
      onClick: () => void;
      danger?: boolean;
    }> = [];

    if (canAddChild) {
      items.push({
        label: "새 문서",
        onClick: () => {
          onAddChild?.(node.id);
        },
      });
    }

    if (!isSection && node.key) {
      items.push(
        {
          label: "새 탭에서 열기",
          onClick: () => {
            window.open(pagePath, "_blank", "noopener,noreferrer");
          },
        },
        {
          label: "이동",
          onClick: () => {
            dispatch(uiActions.showToast({ message: "이동 기능은 준비 중입니다." }));
          },
        },
        {
          label: "삭제",
          onClick: () => {
            onMoveToTrash?.(pageId);
            if (myKey === activeKey) {
              navigate("/");
            }
          },
          danger: true,
        }
      );
    }

    if (items.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    dispatch(
      uiActions.openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items,
      })
    );
  };

  return (
    <div className={styles.node} style={{ "--level": level } as React.CSSProperties}>
      <div
        className={[
          styles.row,
          showChevron ? styles.rowHasChevron : "",
          isActive ? styles.active : "",
          isDragging ? styles.dragging : "",
          isDropBefore ? styles.dropBefore : "",
          isDropAfter ? styles.dropAfter : "",
          isDropInside ? styles.dropInside : "",
        ].filter(Boolean).join(" ")}
        onClick={onRowClick}
        onContextMenu={onRowContextMenu}
        draggable={!isSection}
        onDragStart={(event) => {
          if (isSection) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", pageId);
          onDragStartPage?.(pageId);
        }}
        onDragEnd={() => {
          onDragEndPage?.();
        }}
        onDragOver={(event) => {
          if (isSection && node.id !== "my") return;
          onDragOverPage?.(event, node, level);
        }}
        onDrop={(event) => {
          onDropPage?.(event, node);
        }}
      >
        <span className={styles.left}>
          <span className={styles.iconSlot} data-fallback={iconFallback(iconName)} aria-hidden="true">
            <span className={styles.nodeIconWrap}>
              <Icon name={iconName} source="url" basePath="/icons" size={16} className={styles.nodeIcon} />
            </span>
            {showChevron ? (
              <button
                type="button"
                className={`${styles.chevronBtn} ${styles.chevronBtnInSlot} ${isOpen ? styles.chevronBtnOpen : ""}`}
                aria-label={isOpen ? "하위 페이지 접기" : "하위 페이지 펼치기"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(node.id);
                }}
        >
            <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} aria-hidden="true">
              ›
            </span>
          </button>
        ) : null}
      </span>
      <span className={styles.label}>{node.label}</span>
    </span>
      </div>

      {isOpen && hasChildren ? (
        <div className={styles.children}>
          {node.children!.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              level={level + 1}
              activeKey={activeKey}
              openFolderIds={openFolderIds}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onAddChild={onAddChild}
              onMoveToTrash={onMoveToTrash}
              draggingPageId={draggingPageId}
              dropHint={dropHint}
              onDragStartPage={onDragStartPage}
              onDragEndPage={onDragEndPage}
              onDragOverPage={onDragOverPage}
              onDropPage={onDropPage}
            />
          ))}
        </div>
      ) : null}

      {isSection && isOpen && !hasChildren ? (
        <button
          type="button"
          className={[styles.row, styles.empty].join(" ")}
          onClick={() => onAddChild?.(node.id)}
        >
          새 문서 추가
        </button>
      ) : null}
    </div>
  );
}

export { FolderNode };
