import type { ComponentType } from "react";
import {
  BlocksIcon,
  BrushIcon,
  CodeIcon,
  FilesIcon,
  PaletteIcon,
  SlidersIcon,
} from "../../components/Icons.tsx";

export type SiteSection =
  "content" | "design" | "style" | "addOns" | "customCode" | "settings";

export type SiteSectionEntry = {
  section: SiteSection;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

export const siteSectionEntries: SiteSectionEntry[] = [
  { section: "content", label: "Content", Icon: FilesIcon },
  { section: "design", label: "Design", Icon: PaletteIcon },
  { section: "style", label: "Style", Icon: BrushIcon },
  { section: "addOns", label: "Add-ons", Icon: BlocksIcon },
  { section: "customCode", label: "Custom code", Icon: CodeIcon },
  { section: "settings", label: "Site settings", Icon: SlidersIcon },
];

const SECTION_KEY_PREFIX = "nefantaris.siteSection:";

function isSiteSection(value: string | null): value is SiteSection {
  return siteSectionEntries.some((entry) => entry.section === value);
}

export function loadSiteSection(sitePath: string): SiteSection {
  try {
    const stored = globalThis.localStorage.getItem(
      `${SECTION_KEY_PREFIX}${sitePath}`,
    );
    return isSiteSection(stored) ? stored : "content";
  } catch {
    return "content";
  }
}

export function saveSiteSection(sitePath: string, section: SiteSection): void {
  try {
    globalThis.localStorage.setItem(
      `${SECTION_KEY_PREFIX}${sitePath}`,
      section,
    );
  } catch {
    return;
  }
}
