import React from "react";
import { Button, Icon } from "@jho951/ui-components";

import type { AppDispatch } from "@app/store/store.ts";
import type { EditorBlockState } from "@features/editor/model/editor.types.ts";
import { editorActions } from "@features/editor/state/editor.slice.ts";
import type { BlockEditorInteractions } from "@features/editor/ui/block-editor/useBlockEditorInteractions.ts";
import {
  BLOCK_TYPE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  hasMark,
  readTextColor,
  textareaClass,
  textareaStyle,
} from "@features/editor/ui/block-editor/blockEditor.utils.ts";

import styles from "./BlockEditor.module.css";

interface BlockEditorRowProps {
  block: EditorBlockState;
  dispatch: AppDispatch;
  interactions: BlockEditorInteractions;
  isDragging: boolean;
  isMenuOpen: boolean;
  isSelected: boolean;
  dropAfter: boolean;
  dropBefore: boolean;
}

function BlockEditorRow({
  block,
  dispatch,
  interactions,
  isDragging,
  isMenuOpen,
  isSelected,
  dropAfter,
  dropBefore,
}: BlockEditorRowProps): React.ReactElement {
  return (
    <article
      ref={(element) => {
        interactions.registerRowRef(block.id, element);
      }}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${dropBefore ? styles.rowDropBefore : ""} ${dropAfter ? styles.rowDropAfter : ""} ${isDragging ? styles.rowDragging : ""}`}
      onClick={() => interactions.handleRowClick(block.id)}
    >
      <div className={styles.leftRail}>
        <button
          type="button"
          className={`${styles.contextTrigger} ${isMenuOpen ? styles.contextTriggerActive : ""}`}
          data-block-editor-trigger="true"
          aria-label="블록 메뉴 열기"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            interactions.toggleMenu(block.id);
          }}
        >
          <Icon name="plus" source="url" basePath="/icons" size={14} />
        </button>
        <button
          type="button"
          className={styles.drag}
          aria-label="블록 이동 핸들"
          onPointerDown={(event) => interactions.handleStartDragging(block.id, event)}
        >
          <Icon name="dragHandle" source="url" basePath="/icons" size={14} />
        </button>

        {isSelected && isMenuOpen ? (
          <div
            data-block-editor-menu="true"
            ref={(element) => {
              interactions.registerMenuRef(block.id, element);
            }}
            className={styles.contextMenu}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.menuSection}>
              <div className={styles.menuLabel}>Type</div>
              <div className={styles.menuChips}>
                {BLOCK_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.menuChip} ${block.draft.type === option.value ? styles.menuChipActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      dispatch(
                        editorActions.setBlockType({
                          blockId: block.id,
                          type: option.value,
                        }),
                      )
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.menuSection}>
              <div className={styles.menuLabel}>Format</div>
              <div className={styles.menuChips}>
                <button
                  type="button"
                  className={`${styles.menuChip} ${hasMark(block, "bold") ? styles.menuChipActive : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    dispatch(
                      editorActions.toggleBlockMark({
                        blockId: block.id,
                        markType: "bold",
                      }),
                    )
                  }
                >
                  B
                </button>
                <button
                  type="button"
                  className={`${styles.menuChip} ${hasMark(block, "italic") ? styles.menuChipActive : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    dispatch(
                      editorActions.toggleBlockMark({
                        blockId: block.id,
                        markType: "italic",
                      }),
                    )
                  }
                >
                  I
                </button>
                <button
                  type="button"
                  className={`${styles.menuChip} ${hasMark(block, "underline") ? styles.menuChipActive : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    dispatch(
                      editorActions.toggleBlockMark({
                        blockId: block.id,
                        markType: "underline",
                      }),
                    )
                  }
                >
                  U
                </button>
                <button
                  type="button"
                  className={`${styles.menuChip} ${hasMark(block, "strikethrough") ? styles.menuChipActive : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    dispatch(
                      editorActions.toggleBlockMark({
                        blockId: block.id,
                        markType: "strikethrough",
                      }),
                    )
                  }
                >
                  S
                </button>
              </div>
            </div>

            <div className={styles.menuSection}>
              <div className={styles.menuLabel}>Color</div>
              <div className={styles.colorSwatches}>
                {TEXT_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.colorSwatch} ${readTextColor(block) === color ? styles.colorSwatchActive : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`텍스트 색상 ${color}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      dispatch(
                        editorActions.setBlockTextColor({
                          blockId: block.id,
                          value: color,
                        }),
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  className={styles.clearColorChip}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    dispatch(
                      editorActions.setBlockTextColor({
                        blockId: block.id,
                        value: null,
                      }),
                    )
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`${styles.block} ${isSelected ? styles.blockSelected : ""} ${block.status === "conflicted" ? styles.blockConflict : ""}`}
      >
        <textarea
          ref={(element) => {
            interactions.registerTextareaRef(block.id, element);
          }}
          data-editor-block-input="true"
          rows={1}
          className={textareaClass(block)}
          style={textareaStyle(block)}
          value={block.draft.text}
          onFocus={() => interactions.handleTextareaFocus(block.id)}
          onCompositionStart={() => {
            interactions.handleTextareaCompositionStart(block.id);
          }}
          onCompositionEnd={(event) => {
            interactions.handleTextareaCompositionEnd(block.id, event);
          }}
          onKeyDown={(event) => interactions.handleTextareaKeyDown(block, event)}
          onChange={(event) =>
            dispatch(
              editorActions.updateBlockText({
                blockId: block.id,
                text: event.target.value,
              }),
            )
          }
          placeholder={block.draft.type === "paragraph" ? "텍스트를 입력하세요" : "제목을 입력하세요"}
        />

        {block.status === "conflicted" && block.remoteContent ? (
          <div className={styles.conflictBox}>
            <div className={styles.conflictTitle}>서버 최신본과 충돌했습니다.</div>
            <div className={styles.conflictText}>{block.remoteContent.text || "(empty)"}</div>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="ghost"
                size="s"
                onClick={() =>
                  dispatch(
                    editorActions.consumeConflict({
                      blockId: block.id,
                      useRemote: false,
                    }),
                  )
                }
              >
                내 수정 유지
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="s"
                onClick={() =>
                  dispatch(
                    editorActions.consumeConflict({
                      blockId: block.id,
                      useRemote: true,
                    }),
                  )
                }
              >
                서버 버전 사용
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export { BlockEditorRow };
