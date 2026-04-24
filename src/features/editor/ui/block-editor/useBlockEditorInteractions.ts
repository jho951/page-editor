import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppDispatch } from "@app/store/store.ts";
import type { EditorBlockState } from "@features/editor/model/editor.types.ts";
import { editorActions } from "@features/editor/state/editor.slice.ts";

type BlockDropHint = {
  targetBlockId: string;
  placement: "before" | "after";
};

type MenuState = {
  blockId: string | null;
  closeSignal: number;
};

interface UseBlockEditorInteractionsOptions {
  blocks: EditorBlockState[];
  closeMenuSignal: number;
  dispatch: AppDispatch;
  selectedBlockId: string | null;
}

interface BlockEditorInteractions {
  draggingBlockId: string | null;
  dropHint: BlockDropHint | null;
  menuBlockId: string | null;
  closeMenu: () => void;
  focusBlockTextarea: (blockId: string, offset?: number, selectAll?: boolean) => void;
  handleRowClick: (blockId: string) => void;
  handleStartDragging: (blockId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  handleTextareaCompositionEnd: (
    blockId: string,
    event: React.CompositionEvent<HTMLTextAreaElement>,
  ) => void;
  handleTextareaCompositionStart: (blockId: string) => void;
  handleTextareaFocus: (blockId: string) => void;
  handleTextareaKeyDown: (
    block: EditorBlockState,
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void;
  isEditorInputFocused: () => boolean;
  registerMenuRef: (blockId: string, element: HTMLDivElement | null) => void;
  registerRowRef: (blockId: string, element: HTMLElement | null) => void;
  registerTextareaRef: (blockId: string, element: HTMLTextAreaElement | null) => void;
  toggleMenu: (blockId: string) => void;
}

function useBlockEditorInteractions({
  blocks,
  closeMenuSignal,
  dispatch,
  selectedBlockId,
}: UseBlockEditorInteractionsOptions): BlockEditorInteractions {
  const [menuState, setMenuState] = useState<MenuState>({
    blockId: null,
    closeSignal: closeMenuSignal,
  });
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<BlockDropHint | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const composingBlockIdRef = useRef<string | null>(null);
  const pendingSplitBlockIdRef = useRef<string | null>(null);
  const pendingCaretRef = useRef<{ blockId: string; offset: number } | null>(null);
  const recentSplitRef = useRef<{ signature: string; at: number } | null>(null);
  const dropHintRef = useRef<BlockDropHint | null>(null);
  const dragScrollContainerRef = useRef<HTMLElement | null>(null);

  const menuBlockId = useMemo(() => {
    if (menuState.closeSignal !== closeMenuSignal) return null;
    if (!menuState.blockId) return null;
    return blocks.some((block) => block.id === menuState.blockId) ? menuState.blockId : null;
  }, [blocks, closeMenuSignal, menuState]);

  const closeMenu = useCallback(() => {
    setMenuState({
      blockId: null,
      closeSignal: closeMenuSignal,
    });
  }, [closeMenuSignal]);

  const registerRowRef = useCallback((blockId: string, element: HTMLElement | null) => {
    rowRefs.current[blockId] = element;
  }, []);

  const registerMenuRef = useCallback((blockId: string, element: HTMLDivElement | null) => {
    menuRefs.current[blockId] = element;
  }, []);

  const registerTextareaRef = useCallback((blockId: string, element: HTMLTextAreaElement | null) => {
    textareaRefs.current[blockId] = element;
  }, []);

  const focusBlockTextarea = useCallback(
    (blockId: string, offset = Number.MAX_SAFE_INTEGER, selectAll = false): void => {
      const textarea = textareaRefs.current[blockId];
      if (!textarea) return;

      textarea.focus();
      if (selectAll) {
        textarea.setSelectionRange(0, textarea.value.length);
        return;
      }

      const nextOffset = Math.max(0, Math.min(offset, textarea.value.length));
      textarea.setSelectionRange(nextOffset, nextOffset);
    },
    [],
  );

  const isEditorInputFocused = useCallback((): boolean => {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLElement && activeElement.dataset.editorBlockInput === "true";
  }, []);

  const splitBlockFromTextarea = useCallback(
    (blockId: string, textarea: HTMLTextAreaElement | null): void => {
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
      setMenuState({
        blockId: null,
        closeSignal: closeMenuSignal,
      });
    },
    [closeMenuSignal, dispatch],
  );

  const moveCaretToBlock = useCallback(
    (blockId: string, offset: number): void => {
      pendingCaretRef.current = { blockId, offset };
      dispatch(editorActions.setSelectedBlock(blockId));
      setMenuState({
        blockId: null,
        closeSignal: closeMenuSignal,
      });
    },
    [closeMenuSignal, dispatch],
  );

  const findAdjacentBlockId = useCallback(
    (blockId: string, direction: "previous" | "next"): string | null => {
      const currentIndex = blocks.findIndex((candidate) => candidate.id === blockId);
      if (currentIndex < 0) return null;

      const target =
        direction === "previous" ? blocks[currentIndex - 1] : blocks[currentIndex + 1];
      return target?.id ?? null;
    },
    [blocks],
  );

  const handleArrowBlockNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>, block: EditorBlockState): boolean => {
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
    },
    [findAdjacentBlockId, moveCaretToBlock],
  );

  const updateDropHintFromPointer = useCallback(
    (draggedBlockId: string, clientY: number): void => {
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
        .filter(
          (
            candidate,
          ): candidate is {
            targetBlockId: string;
            placement: "before" | "after";
            distance: number;
          } => Boolean(candidate),
        );

      if (candidates.length === 0) {
        setDropHint(null);
        return;
      }

      const nextHint = candidates.reduce((best, candidate) =>
        candidate.distance < best.distance ? candidate : best,
      );

      setDropHint({
        targetBlockId: nextHint.targetBlockId,
        placement: nextHint.placement,
      });
    },
    [blocks],
  );

  const findScrollContainer = useCallback((element: HTMLElement | null): HTMLElement | null => {
    let current = element?.parentElement ?? null;

    while (current) {
      const { overflowY } = window.getComputedStyle(current);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight
      ) {
        return current;
      }
      current = current.parentElement;
    }

    if (document.scrollingElement instanceof HTMLElement) {
      return document.scrollingElement;
    }

    return document.documentElement;
  }, []);

  const autoScrollWhileDragging = useCallback((clientY: number): void => {
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
  }, []);

  const handleRowClick = useCallback(
    (blockId: string) => {
      dispatch(editorActions.setSelectedBlock(blockId));
    },
    [dispatch],
  );

  const toggleMenu = useCallback(
    (blockId: string) => {
      dispatch(editorActions.setSelectedBlock(blockId));
      setMenuState((current) => ({
        blockId:
          current.closeSignal === closeMenuSignal && current.blockId === blockId ? null : blockId,
        closeSignal: closeMenuSignal,
      }));
    },
    [closeMenuSignal, dispatch],
  );

  const handleStartDragging = useCallback(
    (blockId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dispatch(editorActions.setSelectedBlock(blockId));
      setDraggingBlockId(blockId);
      setMenuState({
        blockId: null,
        closeSignal: closeMenuSignal,
      });
      dragScrollContainerRef.current = findScrollContainer(rowRefs.current[blockId]);
      updateDropHintFromPointer(blockId, event.clientY);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [closeMenuSignal, dispatch, findScrollContainer, updateDropHintFromPointer],
  );

  const handleTextareaFocus = useCallback(
    (blockId: string) => {
      dispatch(editorActions.setSelectedBlock(blockId));
    },
    [dispatch],
  );

  const handleTextareaCompositionStart = useCallback((blockId: string) => {
    composingBlockIdRef.current = blockId;
  }, []);

  const handleTextareaCompositionEnd = useCallback(
    (blockId: string, event: React.CompositionEvent<HTMLTextAreaElement>) => {
      if (composingBlockIdRef.current === blockId) {
        composingBlockIdRef.current = null;
      }
      if (pendingSplitBlockIdRef.current !== blockId) return;

      pendingSplitBlockIdRef.current = null;
      window.requestAnimationFrame(() => {
        splitBlockFromTextarea(blockId, textareaRefs.current[blockId] ?? event.currentTarget);
      });
    },
    [splitBlockFromTextarea],
  );

  const handleTextareaKeyDown = useCallback(
    (block: EditorBlockState, event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        setMenuState({
          blockId: null,
          closeSignal: closeMenuSignal,
        });
      }
    },
    [blocks.length, closeMenuSignal, dispatch, handleArrowBlockNavigation, splitBlockFromTextarea],
  );

  useEffect(() => {
    if (!menuBlockId) return;

    const closeMenuIfOutside = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return;

      const menuElement = menuRefs.current[menuBlockId];
      if (menuElement?.contains(target)) return;
      closeMenu();
    };

    const onPointerDown = (event: PointerEvent) => closeMenuIfOutside(event.target);
    const onMouseDown = (event: MouseEvent) => closeMenuIfOutside(event.target);
    const onClick = (event: MouseEvent) => closeMenuIfOutside(event.target);
    const onTouchStart = (event: TouchEvent) => closeMenuIfOutside(event.target);
    const onFocusIn = (event: FocusEvent) => closeMenuIfOutside(event.target);

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("touchstart", onTouchStart, true);
    document.addEventListener("focusin", onFocusIn, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [closeMenu, menuBlockId]);

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
  }, [autoScrollWhileDragging, dispatch, draggingBlockId, updateDropHintFromPointer]);

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

  return {
    closeMenu,
    draggingBlockId,
    dropHint,
    focusBlockTextarea,
    handleRowClick,
    handleStartDragging,
    handleTextareaCompositionEnd,
    handleTextareaCompositionStart,
    handleTextareaFocus,
    handleTextareaKeyDown,
    isEditorInputFocused,
    menuBlockId,
    registerMenuRef,
    registerRowRef,
    registerTextareaRef,
    toggleMenu,
  };
}

export { useBlockEditorInteractions };
export type { BlockDropHint, BlockEditorInteractions };
