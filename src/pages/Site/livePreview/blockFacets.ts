import { Facet } from "@codemirror/state";
import type { BlockSchema } from "../../../../electron/ipcContract.cts";

export type BlockSchemas = Record<string, BlockSchema>;

export type BlockOptionsHandler = (lineFrom: number) => void;

export const blockSchemasFacet = Facet.define<
  BlockSchemas | null,
  BlockSchemas | null
>({
  combine: (values) => values[0] ?? null,
});

export const blockOptionsHandlerFacet = Facet.define<
  BlockOptionsHandler,
  BlockOptionsHandler | null
>({
  combine: (values) => values[0] ?? null,
});
