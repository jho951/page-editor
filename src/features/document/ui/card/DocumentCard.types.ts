/**
 * Document Card 관련 타입을 정의합니다.
 */

import type { DocCardItem, DocCardPreviewItem } from "@features/document/model/document.types.ts";
import type {DocumentsViewMode} from "@features/document/ui/tab/DocumentTab.types.ts";

export interface DocumentCardProps {
    item: DocCardItem;
    onClick?: (id: string) => void;
    variant?: DocumentsViewMode;
    preview?: DocCardPreviewItem[];
    previewState?: "idle" | "loading" | "ready";
}
