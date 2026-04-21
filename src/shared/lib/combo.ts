import {MOD} from '@jho951/ui-components';

/** 특수 키 조합을 표준 표기로 맞추기 위한 별칭 맵입니다. */
const KEY_ALIASES: Record<string, string> = Object.freeze({
    "Mod+Shift+=": "Mod+Plus",
    "Mod+Shift++": "Mod+Plus",
    "Mod++": "Mod+Plus",
});

/**
 * 키보드 이벤트를 표준 단축키 문자열로 변환합니다.
 *
 * @param e 처리할 키보드 이벤트입니다.
 * @returns 정규화된 단축키 문자열을 반환합니다.
 */
export function eventToCombo(e: KeyboardEvent): string {
    const parts: string[] = [];

    if (e.getModifierState?.(MOD)) parts.push("Mod");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    let k = e.code || e.key || "";

    if (k === "NumpadAdd") k = "=";
    if (k === "NumpadSubtract") k = "-";
    if (k === "Numpad0") k = "0";
    if (k === "Space" || k === "Spacebar") k = "Space";
    if (k === "Slash") k = "/";

    if (/^Key[A-Z]$/.test(k)) k = k.slice(3);
    if (/^Digit[0-9]$/.test(k)) k = k.slice(5);

    if (k === "+") k = "=";
    if (k.length === 1) k = k.toUpperCase();

    parts.push(k);
    return parts.join("+");
}

/**
 * Combo를 정규화합니다.
 *
 * @param combo 정규화할 단축키 문자열입니다.
 * @returns 비교 가능한 표준 단축키 문자열을 반환합니다.
 */
export function normalizeCombo(combo: string): string {
    const trimmed = combo.replace(/\s+/g, "");
    return KEY_ALIASES[trimmed] ?? trimmed;
}

/**
 * Typing Target 여부를 확인합니다.
 *
 * @param el 검사할 DOM 요소입니다.
 * @returns 입력 가능한 요소이면 `true`, 아니면 `false`를 반환합니다.
 */
export function isTypingTarget(el: Element | null): boolean {
    if (!el) return false;

    const tag = el.tagName.toLowerCase();

    const editable = el.getAttribute("contenteditable");
    return tag === "input" || tag === "textarea" || editable === "" || editable === "true";
}

/**
 * 기본 브라우저 동작을 막고 콜백을 실행합니다.
 *
 * @param e 처리할 이벤트 객체입니다.
 * @param fn 조건부로 실행할 콜백 함수입니다.
 * @returns 반환값이 없습니다.
 */
export function withPreventDefaults(e: Event, fn?: () => void): void {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
}
