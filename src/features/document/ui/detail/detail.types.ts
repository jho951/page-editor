export type DocumentDetailState = {
  createdAt?: string;
  id: string;
  title: string;
  version: number;
};

export type DocumentTitleSaveState = "idle" | "saving" | "saved" | "error";
