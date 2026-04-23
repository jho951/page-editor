/**
 * catalog 관련 타입을 정의합니다.
 */

import type { DocCardItem } from "@features/document/model/document.types.ts";
import type { ApiEnvelope as ServiceApiEnvelope, DocumentResponse } from "@shared/api/service-contract.ts";

export type ApiEnvelope<T> = ServiceApiEnvelope<T>;
export type RemoteCatalogItem = DocumentResponse;

export interface FetchCatalogResult {
    items: DocCardItem[];
    source: "local" | "remote";
}
