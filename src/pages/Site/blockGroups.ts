import type { SiteInspection } from "../../../electron/ipcContract.cts";
import { addOnTitleFor } from "./addOnCatalog.ts";

export type BlockChoice = {
  name: string;
  label: string;
  description: string | null;
  plugin: string | null;
};

export type BlockGroup = {
  title: string;
  blocks: BlockChoice[];
};

export function blockChoicesFrom(
  inspection: SiteInspection | null,
): BlockChoice[] {
  const schemas = inspection?.directiveSchemas ?? null;
  if (schemas === null) {
    return (inspection?.directives ?? []).map((name) => ({
      name,
      label: name,
      description: null,
      plugin: null,
    }));
  }
  return Object.entries(schemas).map(([name, schema]) => ({
    name,
    label: schema.label,
    description: schema.description,
    plugin: schema.plugin,
  }));
}

function groupTitleFor(plugin: string | null): string {
  return plugin === null
    ? "From your theme"
    : `From add-ons: ${addOnTitleFor(plugin)}`;
}

export function blockGroupsFrom(blocks: BlockChoice[]): BlockGroup[] {
  const sources = [
    ...new Set([
      ...(blocks.some((block) => block.plugin === null) ? [null] : []),
      ...blocks.flatMap((block) =>
        block.plugin === null ? [] : [block.plugin],
      ),
    ]),
  ];
  return sources.map((plugin) => ({
    title: groupTitleFor(plugin),
    blocks: blocks.filter((block) => block.plugin === plugin),
  }));
}
