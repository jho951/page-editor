/**
 * 전역 단축키 이벤트를 구독하고 Redux 액션으로 연결합니다.
 */

import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@app/store/store";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import type { ProvidersProps } from "@app/provider/provider.types";
import {
    eventToCombo,
    isTypingTarget,
    normalizeCombo,
    withPreventDefaults
} from "@shared/lib/combo";
import {
    shortcutsActions,
    selectShortcutBindingsForScope,
    selectShortcutEnabled,
    selectShortcutOverlayDepth,
    selectShortcutScope
} from "@features/shortcuts/index.ts";
import type { ShortcutScope } from "@features/shortcuts/index.ts";

/**
 * Binding를 찾습니다.
 *
 * @param bindings 검사할 단축키 바인딩 목록입니다.
 * @param combo 정규화할 단축키 문자열입니다.
 * @param scope 현재 단축키 스코프입니다.
 * @returns 계산된 결과를 반환합니다.
 */
function findBinding(
    bindings: ReturnType<typeof selectShortcutBindingsForScope>,
    combo: string,
    scope: ShortcutScope
) {
    return (
        bindings.find((binding) => binding.scope === scope && binding.combo === combo) ??
        bindings.find((binding) => binding.scope === "global" && binding.combo === combo) ??
        null
    );
}

function hasNativeSelectAllTarget(target: Element | null): boolean {
    if (!target) return false;

    if (target instanceof HTMLTextAreaElement) return true;

    if (target instanceof HTMLInputElement) {
        const type = target.type.toLowerCase();
        return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
    }

    return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * 전역 단축키 이벤트를 구독해 Redux 액션으로 연결합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function ShortcutProvider({ children }: ProvidersProps): React.ReactElement {

    const dispatch = useAppDispatch();

    const enabled = useAppSelector(selectShortcutEnabled);

    const scope = useAppSelector(selectShortcutScope);

    const overlayDepth = useAppSelector(selectShortcutOverlayDepth);

    const bindings = useSelector((s: RootState) => selectShortcutBindingsForScope(s, scope));

    useEffect(() => {
        if (!enabled) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.isComposing) return;
            if (overlayDepth > 0) return;

            const combo = normalizeCombo(eventToCombo(e));

            const target = e.target instanceof Element ? e.target : null;

            const typing = isTypingTarget(target);
            if (typing && combo === "Enter") return;
            if (combo === "Mod+A" && hasNativeSelectAllTarget(target)) return;

            const binding = findBinding(bindings, combo, scope);
            if (!binding) return;
            if (typing && !binding.allowInInput) return;

            withPreventDefaults(e, () => {
                dispatch(
                    shortcutsActions.triggerShortcut({
                        combo,
                        command: binding.command,
                        scope: binding.scope,
                    })
                );
            });
        };

        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, [bindings, dispatch, enabled, overlayDepth, scope]);

    return <>{children}</>;
}

export {ShortcutProvider}
