import type { Extension } from "@codemirror/state";
import { createBlockPreviewField } from "./blockDecorations.ts";
import { directiveRegionsField, frontmatterField } from "./documentRegions.ts";
import { inlinePreviewPlugin } from "./inlineDecorations.ts";
import { createLinkClickHandler } from "./linkInteraction.ts";
import { livePreviewTheme } from "./previewTheme.ts";

export type LivePreviewConfig = {
  sitePath: string;
};

export function livePreviewExtensions(config: LivePreviewConfig): Extension[] {
  return [
    frontmatterField,
    directiveRegionsField,
    createBlockPreviewField(config.sitePath),
    inlinePreviewPlugin,
    createLinkClickHandler(),
    livePreviewTheme,
  ];
}
