import type React from "react";

import type { EditorBlockState } from "@features/editor/model/editor.types.ts";

import styles from "./BlockEditor.module.css";

const BLOCK_TYPE_OPTIONS: Array<{ label: string; value: EditorBlockState["draft"]["type"] }> = [
  { label: "P", value: "paragraph" },
  { label: "H1", value: "heading1" },
  { label: "H2", value: "heading2" },
  { label: "H3", value: "heading3" },
];

const TEXT_COLOR_OPTIONS = ["#1F2937", "#2563EB", "#0F766E", "#D97706", "#DC2626", "#7C3AED"];

function hasMark(
  block: EditorBlockState,
  markType: "bold" | "italic" | "underline" | "strikethrough",
): boolean {
  return block.draft.marks.some((mark) => mark.type === markType);
}

function readTextColor(block: EditorBlockState): string {
  const textColor = block.draft.marks.find((mark) => mark.type === "textColor");
  return textColor?.type === "textColor" ? textColor.value : "";
}

function textareaClass(block: EditorBlockState): string {
  if (block.draft.type === "heading1") return `${styles.textarea} ${styles.textareaHeading1}`;
  if (block.draft.type === "heading2") return `${styles.textarea} ${styles.textareaHeading2}`;
  if (block.draft.type === "heading3") return `${styles.textarea} ${styles.textareaHeading3}`;
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

export {
  BLOCK_TYPE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  hasMark,
  readTextColor,
  textareaClass,
  textareaStyle,
};
