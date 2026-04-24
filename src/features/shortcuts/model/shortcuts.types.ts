/**
 * shortcuts 관련 타입을 정의합니다.
 */

export type ShortcutScope = "global" | "text";

export type ShortcutCommand =
  | "undo-edit"
  | "redo-edit"
  | "new-page"
  | "open-search"
  | "show-shortcuts"
  | "close-overlay"
  | "select-current-block"
  | "clear-block-selection"
  | "edit-selected-block"
  | "open-block-menu"
  | "duplicate-block"
  | "move-block-up"
  | "move-block-down"
  | "indent-block"
  | "outdent-block"
  | "turn-into-text"
  | "turn-into-page"
  | "turn-into-heading-1"
  | "turn-into-heading-2"
  | "turn-into-heading-3"
  | "turn-into-bulleted-list"
  | "turn-into-numbered-list"
  | "turn-into-toggle-list"
  | "turn-into-to-do"
  | "turn-into-code-block"
  | "modify-current-block"
  | "toggle-theme"
  | "format-bold"
  | "format-italic"
  | "format-underline"
  | "format-strikethrough"
  | "format-inline-code"
  | "create-link"
  | "comment-selection"
  | "apply-last-color";

export interface ShortcutBinding {
  combo: string;
  command: ShortcutCommand;
  scope: ShortcutScope;
  label: string;
  description: string;
  allowInInput?: boolean;
}

export interface ShortcutTriggerPayload {
  combo: string;
  command: ShortcutCommand;
  scope: ShortcutScope;
}

export interface ShortcutEvent extends ShortcutTriggerPayload {
  id: number;
  triggeredAt: number;
}
