/**
 * 블록 목록을 렌더링하고 편집 액션을 연결하는 에디터 UI입니다.
 */

import React from "react";
import { Button, Switch } from "@jho951/ui-components";
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

/**
 * 블록 타입에 따라 textarea 스타일 클래스를 계산합니다.
 *
 * @param block 스타일을 계산할 블록 객체입니다.
 * @returns 문자열 결과를 반환합니다.
 */
function textareaClass(block: EditorBlockState): string {
  if (block.draft.type === "heading1") return `${styles.textarea} ${styles.textareaHeading1}`;
  if (block.draft.type === "heading2") return `${styles.textarea} ${styles.textareaHeading2}`;
  if (block.draft.type === "heading3") return `${styles.textarea} ${styles.textareaHeading3}`;
  if (block.draft.type === "code_block") return `${styles.textarea} ${styles.textareaCode}`;
  return styles.textarea;
}

/**
 * 블록 편집 화면을 렌더링하고 편집 액션을 연결합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function BlockEditor({ documentId }: BlockEditorProps): React.ReactElement {
  const { blocks, dispatch, errorMessage, saveDocument, saveState, selectedBlockId, statusText } = useBlockEditorController(documentId);

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.insertBlockAfter({ afterBlockId: selectedBlockId }))}>
          블록 추가
        </Button>
        <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.duplicateSelectedBlock())}>
          복제
        </Button>
        <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.moveSelectedBlock("up"))}>
          위로
        </Button>
        <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.moveSelectedBlock("down"))}>
          아래로
        </Button>
        <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.deleteSelectedBlock())}>
          삭제
        </Button>
        <Button type="button" variant="ghost" size="s" onClick={() => saveDocument(true)} disabled={saveState === "saving"}>
          저장
        </Button>
        <span className={styles.status}>{statusText}</span>
        {errorMessage ? <span className={styles.status}>{errorMessage}</span> : null}
      </div>

      <div className={styles.list}>
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`${styles.row} ${selectedBlockId === block.id ? styles.rowSelected : ""}`}
            onClick={() => dispatch(editorActions.setSelectedBlock(block.id))}
          >
            <div className={styles.drag}>⋮⋮</div>
            <div className={`${styles.block} ${block.status === "conflicted" ? styles.blockConflict : ""}`}>
              <div className={styles.blockHead}>
                <span className={styles.meta}>
                  {block.draft.type} · v{block.version} · {block.status}
                </span>
                {block.draft.type === "to_do" ? (
                  <Switch
                    checked={Boolean(block.draft.checked)}
                    onChange={() => dispatch(editorActions.toggleTodoChecked({ blockId: block.id }))}
                    label="Done"
                  />
                ) : null}
              </div>

              <select
                value={block.draft.type}
                onChange={(e) =>
                  dispatch(
                    editorActions.setBlockType({
                      blockId: block.id,
                      type: e.target.value as EditorBlockState["draft"]["type"],
                    }),
                  )
                }
                aria-label="Block type"
              >
                <option value="paragraph">paragraph</option>
                <option value="heading1">heading1</option>
                <option value="heading2">heading2</option>
                <option value="heading3">heading3</option>
                <option value="bulleted_list">bulleted_list</option>
                <option value="numbered_list">numbered_list</option>
                <option value="to_do">to_do</option>
                <option value="toggle_list">toggle_list</option>
                <option value="code_block">code_block</option>
              </select>

              <textarea
                className={textareaClass(block)}
                value={block.draft.text}
                onFocus={() => dispatch(editorActions.setSelectedBlock(block.id))}
                onChange={(e) =>
                  dispatch(
                    editorActions.updateBlockText({
                      blockId: block.id,
                      text: e.target.value,
                    }),
                  )
                }
                placeholder="텍스트를 입력하세요"
              />

              <div className={styles.actions}>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "paragraph" }))}>
                  P
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "heading1" }))}>
                  H1
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "heading2" }))}>
                  H2
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "heading3" }))}>
                  H3
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "bulleted_list" }))}>
                  Bullet
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "numbered_list" }))}>
                  Number
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "to_do" }))}>
                  Todo
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockType({ blockId: block.id, type: "code_block" }))}>
                  Code
                </Button>
              </div>

              <div className={styles.actions}>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "bold" }))}>
                  {hasMark(block, "bold") ? "Bold On" : "Bold"}
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "italic" }))}>
                  {hasMark(block, "italic") ? "Italic On" : "Italic"}
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "underline" }))}>
                  {hasMark(block, "underline") ? "Underline On" : "Underline"}
                </Button>
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.toggleBlockMark({ blockId: block.id, markType: "strikethrough" }))}>
                  {hasMark(block, "strikethrough") ? "Strike On" : "Strike"}
                </Button>
                <input
                  type="color"
                  value={readTextColor(block) || "#000000"}
                  aria-label="Text color"
                  onChange={(e) => dispatch(editorActions.setBlockTextColor({ blockId: block.id, value: e.target.value }))}
                />
                <Button type="button" variant="ghost" size="s" onClick={() => dispatch(editorActions.setBlockTextColor({ blockId: block.id, value: null }))}>
                  Clear Color
                </Button>
              </div>

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
          </div>
        ))}
      </div>
    </section>
  );
}

export { BlockEditor };
