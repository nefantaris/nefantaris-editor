export type ContentTarget = {
  relativePath: string;
  fileName: string;
  title: string;
  kind: "page" | "post";
};

export type EditorPaneControl = {
  flush: () => Promise<void>;
  cancelPendingSave: () => void;
};

export type RevealRequest = {
  id: number;
  relativePath: string;
  line: number | null;
};
