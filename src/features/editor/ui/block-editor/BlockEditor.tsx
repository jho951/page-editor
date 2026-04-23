/**
 * 블록 목록을 렌더링하고 편집 액션을 연결하는 에디터 UI입니다.
 */

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@jho951/ui-components";
import { editorActions } from "@features/editor/state/editor.slice.ts";
import type { EditorBlockState } from "@features/editor/model/editor.types.ts";
import type { BlockEditorProps } from "@features/editor/ui/block-editor/BlockEditor.types.ts";
import { useBlockEditorController } from "@features/editor/ui/block-editor/useBlockEditorController.ts";
import styles from "@features/editor/ui/block-editor/BlockEditor.module.css";

function hasMark(block: EditorBlockState, markType: "bold" | "italic" | "underline" | "strikethrough"): boolean {
  return block.draft.marks.some((mark) => mark.type === markType);
}

function readTextColor(block: EditorBlockState): string {
  const textColor = block.draft.marks.find((mark) => mark.type === "textColor");
  return textColor?.type === "textColor" ? textColor.value : "";
}

const BLOCK_TYPE_OPTIONS: Array<{ label: string; value: EditorBlockState["draft"]["type"] }> = [
  { label: "P", value: "paragraph" },
  { label: "H1", value: "heading1" },
  { label: "H2", value: "heading2" },
  { label: "H3", value: "heading3" },
];

const TEXT_COLOR_OPTIONS = ["#1F2937", "#2563EB", "#0F766E", "#D97706", "#DC2626", "#7C3AED"];

/**
 * 블록 타입에 따라 textarea 스타일 클래스를 계산합니다.
 *
 * @param block 스타일을 계산할 블록 객체입니다.
 * @returns 문자열 결과를 반환합니다.
 */
function textareaClass(_block: EditorBlockState): string {
  if (_block.draft.type === "heading1") return `${styles.textarea} ${styles.textareaHeading1}`;
  if (_block.draft.type === "heading2") return `${styles.textarea} ${styles.textareaHeading2}`;
  if (_block.draft.type === "heading3") return `${styles.textarea} ${styles.textareaHeading3}`;
  return styles.textarea;
}

function textareaStyle(block: EditorBlockState): React.CSSProperties {
  const textColor = readTextColor(block);
  const textDecorationLine = [
    hasMark(block, "underline") ? "underline" : null,
    hasMark(block, "strikethrough") ? "line-through" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    fontWeight: hasMark(block, "bold") ? 700 : undefined,
    fontStyle: hasMark(block, "italic") ? "italic" : undefined,
    textDecorationLine: textDecorationLine || undefined,
    color: textColor || undefined,
  };
}

/**
 * 블록 편집 화면을 렌더링하고 편집 액션을 연결합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function BlockEditor({ documentId }: BlockEditorProps): React.ReactElement {
  const { blocks, dispatch, selectedBlockId } = useBlockEditorController(documentId);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ targetBlockId: string; placement: "before" | "after" } | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const composingBlockIdRef = useRef<string | null>(null);
  const pendingSplitBlockIdRef = useRef<string | null>(null);
  const pendingCaretRef = useRef<{ blockId: string; offset: number } | null>(null);
  const recentSplitRef = useRef<{ signature: string; at: number } | null>(null);
  const dropHintRef = useRef<{ targetBlockId: string; placement: "before" | "after" } | null>(null);
  const dragScrollContainerRef = useRef<HTMLElement | null>(null);

  const splitBlockFromTextarea = (blockId: string, textarea: HTMLTextAreaElement | null): void => {
    if (!textarea) return;

    const sourceText = textarea.value;
    const selectionStart = textarea.selectionStart ?? sourceText.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const signature = `${blockId}:${selectionStart}:${selectionEnd}:${sourceText}`;
    const now = window.performance.now();

    if (
      recentSplitRef.current?.signature === signature &&
      now - recentSplitRef.current.at < 120
    ) {
      return;
    }

    recentSplitRef.current = { signature, at: now };

    dispatch(
      editorActions.splitBlockAtSelection({
        blockId,
        sourceText,
        selectionStart,
        selectionEnd,
      }),
    );
    setMenuBlockId(null);
  };

  const moveCaretToBlock = (blockId: string, offset: number): void => {
    pendingCaretRef.current = { blockId, offset };
    dispatch(editorActions.setSelectedBlock(blockId));
    setMenuBlockId(null);
  };

  const findAdjacentBlockId = (blockId: string, direction: "previous" | "next"): string | null => {
    const currentIndex = blocks.findIndex((candidate) => candidate.id === blockId);
    if (currentIndex < 0) return null;

    const target = direction === "previous" ? blocks[currentIndex - 1] : blocks[currentIndex + 1];
    return target?.id ?? null;
  };

  const handleArrowBlockNavigation = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    block: EditorBlockState,
  ): boolean => {
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) return false;

    if (event.key === "ArrowUp") {
      const previousBlockId = findAdjacentBlockId(block.id, "previous");
      if (!previousBlockId) return false;

      event.preventDefault();
      moveCaretToBlock(previousBlockId, selectionStart);
      return true;
    }

    if (event.key === "ArrowDown") {
      const nextBlockId = findAdjacentBlockId(block.id, "next");
      if (!nextBlockId) return false;

      event.preventDefault();
      moveCaretToBlock(nextBlockId, selectionStart);
      return true;
    }

    if (event.key === "ArrowLeft" && selectionStart === 0) {
      const previousBlockId = findAdjacentBlockId(block.id, "previous");
      if (!previousBlockId) return false;

      event.preventDefault();
      moveCaretToBlock(previousBlockId, Number.MAX_SAFE_INTEGER);
      return true;
    }

    if (event.key === "ArrowRight" && selectionEnd === textarea.value.length) {
      const nextBlockId = findAdjacentBlockId(block.id, "next");
      if (!nextBlockId) return false;

      event.preventDefault();
      moveCaretToBlock(nextBlockId, 0);
      return true;
    }

    return false;
  };

  const updateDropHintFromPointer = (draggedBlockId: string, clientY: number): void => {
    const candidates = blocks
      .filter((block) => block.id !== draggedBlockId)
      .map((block) => {
        const element = rowRefs.current[block.id];
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        return {
          targetBlockId: block.id,
          placement: clientY < midpoint ? "before" : "after" as const,
          distance: Math.abs(clientY - midpoint),
        };
      })
      .filter((candidate): candidate is { targetBlockId: string; placement: "before" | "after"; distance: number } => Boolean(candidate));

    if (candidates.length === 0) {
      setDropHint(null);
      return;
    }

    const nextHint = candidates.reduce((best, candidate) =>
      candidate.distance < best.distance ? candidate : best
    );

    setDropHint({
      targetBlockId: nextHint.targetBlockId,
      placement: nextHint.placement,
    });
  };

  const findScrollContainer = (element: HTMLElement | null): HTMLElement | null => {
    let current = element?.parentElement ?? null;

    while (current) {
      const { overflowY } = window.getComputedStyle(current);
      if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement;
    }

    if (document.scrollingElement instanceof HTMLElement) {
      return document.scrollingElement;
    }

    return document.documentElement;
  };

  const autoScrollWhileDragging = (clientY: number): void => {
    const container = dragScrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeThreshold = 72;
    const scrollStep = 16;

    if (clientY < rect.top + edgeThreshold) {
      container.scrollBy({ top: -scrollStep });
      return;
    }

    if (clientY > rect.bottom - edgeThreshold) {
      container.scrollBy({ top: scrollStep });
    }
  };

  useEffect(() => {
    if (!menuBlockId) return;
    if (blocks.some((block) => block.id === menuBlockId)) return;
    setMenuBlockId(null);
  }, [blocks, menuBlockId]);

  useEffect(() => {
    dropHintRef.current = dropHint;
  }, [dropHint]);

  useEffect(() => {
    if (!draggingBlockId) return;

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      autoScrollWhileDragging(event.clientY);
      updateDropHintFromPointer(draggingBlockId, event.clientY);
    };

    const finishDragging = () => {
      const currentDropHint = dropHintRef.current;
      if (
        currentDropHint &&
        currentDropHint.targetBlockId !== draggingBlockId
      ) {
        dispatch(
          editorActions.moveBlockByDrop({
            blockId: draggingBlockId,
            targetBlockId: currentDropHint.targetBlockId,
            placement: currentDropHint.placement,
          }),
        );
      }

      setDraggingBlockId(null);
      setDropHint(null);
      dragScrollContainerRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishDragging);
    window.addEventListener("pointercancel", finishDragging);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDragging);
      window.removeEventListener("pointercancel", finishDragging);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dispatch, draggingBlockId, blocks]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const textarea = textareaRefs.current[selectedBlockId];
    if (!textarea) return;

    const isAlreadyActive = document.activeElement === textarea;
    const pendingCaret = pendingCaretRef.current;

    if (!isAlreadyActive) {
      textarea.focus();
    }

    if (pendingCaret?.blockId === selectedBlockId) {
      const cursor = Math.max(0, Math.min(pendingCaret.offset, textarea.value.length));
      textarea.setSelectionRange(cursor, cursor);
      pendingCaretRef.current = null;
      return;
    }

    if (!isAlreadyActive) {
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
    }
  }, [selectedBlockId]);

  return (
    <section className={`${styles.wrap} ${draggingBlockId ? styles.wrapDragging : ""}`}>
      <div className={styles.list}>
        {blocks.map((block) => {
          const isSelected = selectedBlockId === block.id;
          const isMenuOpen = menuBlockId === block.id;
          const dropBefore = dropHint?.targetBlockId === block.id && dropHint.placement === "before";
          const dropAfter = dropHint?.targetBlockId === block.id && dropHint.placement === "after";
          const isDragging = draggingBlockId === block.id;

          return (
            <article
              key={block.id}
              ref={(element) => {
                rowRefs.current[block.id] = element;
              }}
              className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${dropBefore ? styles.rowDropBefore : ""} ${dropAfter ? styles.rowDropAfter : ""} ${isDragging ? styles.rowDragging : ""}`}
              onClick={() => dispatch(editorActions.setSelectedBlock(block.id))}
            >
              <div className={styles.leftRail}>
                <button
                  type="button"
                  className={`${styles.contextTrigger} ${isMenuOpen ? styles.contextTriggerActive : ""}`}
                  aria-label="블록 메뉴 열기"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch(editorActions.setSelectedBlock(block.id));
                    setMenuBlockId((current) => (current === block.id ? null : block.id));
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.drag}
                  aria-label="블록 이동 핸들"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    dispatch(editorActions.setSelectedBlock(block.id));
                    setDraggingBlockId(block.id);
                    setMenuBlockId(null);
                    dragScrollContainerRef.current = findScrollContainer(rowRefs.current[block.id]);
                    updateDropHintFromPointer(block.id, event.clientY);
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                  }}
                >
                  ⋮⋮
                </button>

                {isSelected && isMenuOpen ? (
                  <div className={styles.contextMenu} onClick={(event) => event.stopPropagation()}>
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
                          onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "bold" }))}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          className={`${styles.menuChip} ${hasMark(block, "italic") ? styles.menuChipActive : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "italic" }))}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          className={`${styles.menuChip} ${hasMark(block, "underline") ? styles.menuChipActive : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "underline" }))}
                        >
                          U
                        </button>
                        <button
                          type="button"
                          className={`${styles.menuChip} ${hasMark(block, "strikethrough") ? styles.menuChipActive : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "strikethrough" }))}
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
                            onClick={() => dispatch(editorActions.setBlockTextColor({ blockId: block.id, value: color }))}
                          />
                        ))}
                        <button
                          type="button"
                          className={styles.clearColorChip}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => dispatch(editorActions.setBlockTextColor({ blockId: block.id, value: null }))}
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
                    textareaRefs.current[block.id] = element;
                  }}
                  rows={1}
                  className={textareaClass(block)}
                  style={textareaStyle(block)}
                  value={block.draft.text}
                  onFocus={() => dispatch(editorActions.setSelectedBlock(block.id))}
                  onCompositionStart={() => {
                    composingBlockIdRef.current = block.id;
                  }}
                  onCompositionEnd={(event) => {
                    if (composingBlockIdRef.current === block.id) {
                      composingBlockIdRef.current = null;
                    }
                    if (pendingSplitBlockIdRef.current !== block.id) return;

                    pendingSplitBlockIdRef.current = null;
                    window.requestAnimationFrame(() => {
                      splitBlockFromTextarea(block.id, textareaRefs.current[block.id] ?? event.currentTarget);
                    });
                  }}
                  onKeyDown={(event) => {
                    if (handleArrowBlockNavigation(event, block)) {
                      return;
                    }

                    if (event.key === "Enter" && !event.shiftKey) {
                      if (event.nativeEvent.isComposing || composingBlockIdRef.current === block.id) {
                        event.preventDefault();
                        pendingSplitBlockIdRef.current = block.id;
                        return;
                      }

                      event.preventDefault();
                      splitBlockFromTextarea(block.id, event.currentTarget);
                      return;
                    }

                    if (
                      event.key === "Backspace" &&
                      block.draft.text.length === 0 &&
                      blocks.length > 1
                    ) {
                      event.preventDefault();
                      dispatch(editorActions.setSelectedBlock(block.id));
                      dispatch(editorActions.deleteSelectedBlock());
                      setMenuBlockId(null);
                    }
                  }}
                  onChange={(e) =>
                    dispatch(
                      editorActions.updateBlockText({
                        blockId: block.id,
                        text: e.target.value,
                      }),
                    )}
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
                        onClick={() => dispatch(editorActions.consumeConflict({ blockId: block.id, useRemote: false }))}
                      >
                        내 수정 유지
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="s"
                        onClick={() => dispatch(editorActions.consumeConflict({ blockId: block.id, useRemote: true }))}
                      >
                        서버 버전 사용
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export { BlockEditor };
