/**
 * 블록 목록을 렌더링하고 편집 액션을 연결하는 에디터 UI입니다.
 */

import React, { useEffect } from "react";
import { useAppSelector } from "@app/store/hooks.ts";
import { editorActions } from "@features/editor/state/editor.slice.ts";
import type { BlockEditorProps } from "@features/editor/ui/block-editor/BlockEditor.types.ts";
import { useBlockEditorController } from "@features/editor/ui/block-editor/useBlockEditorController.ts";
import { BlockEditorRow } from "@features/editor/ui/block-editor/BlockEditorRow.tsx";
import { useBlockEditorInteractions } from "@features/editor/ui/block-editor/useBlockEditorInteractions.ts";
import { shortcutsActions, selectShortcutPending } from "@features/shortcuts/index.ts";

import styles from "@features/editor/ui/block-editor/BlockEditor.module.css";

const EDITOR_UI_SHORTCUT_COMMANDS = new Set([
  "select-current-block",
  "clear-block-selection",
  "edit-selected-block",
  "open-block-menu",
  "modify-current-block",
]);

function BlockEditor({ documentId, closeMenuSignal = 0 }: BlockEditorProps): React.ReactElement {
  const { blocks, dispatch, selectedBlockId } = useBlockEditorController(documentId);
  const pendingShortcut = useAppSelector(selectShortcutPending);
  const interactions = useBlockEditorInteractions({
    blocks,
    closeMenuSignal,
    dispatch,
    selectedBlockId,
  });
  const { closeMenu, focusBlockTextarea, isEditorInputFocused, toggleMenu } = interactions;

  useEffect(() => {
    if (!pendingShortcut) return;
    if (!EDITOR_UI_SHORTCUT_COMMANDS.has(pendingShortcut.command)) return;

    const targetBlockId = selectedBlockId ?? blocks[0]?.id ?? null;

    if (pendingShortcut.command !== "select-current-block" && !isEditorInputFocused()) {
      dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
      return;
    }

    switch (pendingShortcut.command) {
      case "select-current-block":
        if (targetBlockId) {
          dispatch(editorActions.setSelectedBlock(targetBlockId));
          window.requestAnimationFrame(() => {
            focusBlockTextarea(targetBlockId, Number.MAX_SAFE_INTEGER, true);
          });
        }
        break;
      case "clear-block-selection":
        closeMenu();
        dispatch(editorActions.setSelectedBlock(null));
        if (document.activeElement instanceof HTMLTextAreaElement) {
          document.activeElement.blur();
        }
        break;
      case "open-block-menu":
      case "modify-current-block":
        if (targetBlockId) {
          dispatch(editorActions.setSelectedBlock(targetBlockId));
          toggleMenu(targetBlockId);
        }
        break;
      case "edit-selected-block":
        if (targetBlockId) {
          dispatch(editorActions.setSelectedBlock(targetBlockId));
          window.requestAnimationFrame(() => {
            focusBlockTextarea(targetBlockId);
          });
        }
        break;
      default:
        break;
    }

    dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
  }, [blocks, closeMenu, dispatch, focusBlockTextarea, isEditorInputFocused, pendingShortcut, selectedBlockId, toggleMenu]);

  return (
    <section className={`${styles.wrap} ${interactions.draggingBlockId ? styles.wrapDragging : ""}`}>
      <div className={styles.list}>
        {blocks.map((block) => (
          <BlockEditorRow
            key={block.id}
            block={block}
            dispatch={dispatch}
            interactions={interactions}
            isDragging={interactions.draggingBlockId === block.id}
            isMenuOpen={interactions.menuBlockId === block.id}
            isSelected={selectedBlockId === block.id}
            dropAfter={
              interactions.dropHint?.targetBlockId === block.id &&
              interactions.dropHint.placement === "after"
            }
            dropBefore={
              interactions.dropHint?.targetBlockId === block.id &&
              interactions.dropHint.placement === "before"
            }
          />
        ))}
      </div>
    </section>
  );
}

export { BlockEditor };
