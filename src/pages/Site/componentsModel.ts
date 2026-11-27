import type {
  ComponentListing,
  ComponentOverrideState,
  SiteInspection,
} from "../../../electron/ipcContract.cts";

export type ComponentGroupId =
  "layout" | "templates" | "blocks" | "components" | "styles";

export type ComponentEntry = {
  path: string;
  label: string;
  override: ComponentOverrideState | null;
};

export type ComponentGroup = {
  id: ComponentGroupId;
  title: string;
  description: string;
  entries: ComponentEntry[];
};

const groupOrder: ComponentGroupId[] = [
  "layout",
  "templates",
  "blocks",
  "components",
  "styles",
];

const groupTexts: Record<
  ComponentGroupId,
  { title: string; description: string }
> = {
  layout: {
    title: "Layout",
    description: "The frame around every page: the header, menu, and footer.",
  },
  templates: {
    title: "Page templates",
    description: "How each kind of page is laid out.",
  },
  blocks: {
    title: "Blocks",
    description: "The blocks you add to your pages.",
  },
  components: {
    title: "Other components",
    description: "Smaller pieces the layout, templates, and blocks share.",
  },
  styles: {
    title: "Styles",
    description:
      "Customizing your theme’s stylesheet replaces all of it. For small changes, use the Styles tab instead.",
  },
};

const codeFilePattern = /\.(?:tsx|ts|jsx|js|mjs)$/;
const styleFilePattern = /\.css$/;
const extensionPattern = /\.[^.]+$/;
const templateSuffixPattern = /Template$/;
const wordBoundaryPattern = /([a-z0-9])([A-Z])|[-_\s]+/g;

function isVisiblePath(filePath: string): boolean {
  return filePath
    .split("/")
    .every((segment) => segment !== "" && !segment.startsWith("."));
}

function groupOf(filePath: string): ComponentGroupId | null {
  if (!isVisiblePath(filePath)) {
    return null;
  }
  if (styleFilePattern.test(filePath)) {
    return "styles";
  }
  if (!codeFilePattern.test(filePath)) {
    return null;
  }
  const segments = filePath.split("/");
  if (segments.length === 1 && segments[0].startsWith("Layout.")) {
    return "layout";
  }
  if (segments[0] === "templates") {
    return "templates";
  }
  if (segments[0] === "directives") {
    return "blocks";
  }
  return "components";
}

function stemOf(filePath: string): string {
  return (filePath.split("/").at(-1) ?? filePath).replace(extensionPattern, "");
}

function comparable(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

export function humanized(name: string): string {
  const words = name
    .replaceAll(
      wordBoundaryPattern,
      (_match, before?: string, after?: string) =>
        before === undefined ? " " : `${before} ${after}`,
    )
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function templateLabel(stem: string, templates: string[]): string {
  const name = stem.replace(templateSuffixPattern, "") || stem;
  const declared = templates.find(
    (template) => comparable(template) === comparable(name),
  );
  return humanized(declared ?? name);
}

function blockLabel(stem: string, inspection: SiteInspection | null): string {
  const match = Object.entries(inspection?.directiveSchemas ?? {}).find(
    ([name]) => comparable(name) === comparable(stem),
  );
  return match === undefined ? humanized(stem) : match[1].label;
}

function labelOf(
  filePath: string,
  group: ComponentGroupId,
  inspection: SiteInspection | null,
): string {
  const stem = stemOf(filePath);
  switch (group) {
    case "layout": {
      return "Layout";
    }
    case "templates": {
      return templateLabel(stem, inspection?.templates ?? []);
    }
    case "blocks": {
      return blockLabel(stem, inspection);
    }
    case "styles": {
      return filePath === "theme.css" ? "Theme stylesheet" : humanized(stem);
    }
    case "components": {
      return humanized(stem);
    }
  }
}

export function componentGroupsFrom(
  listing: Extract<ComponentListing, { status: "ok" }>,
  inspection: SiteInspection | null,
): ComponentGroup[] {
  const overrideStates = new Map(
    listing.overrides.map((override) => [override.path, override.state]),
  );
  const paths = [...new Set([...listing.files, ...overrideStates.keys()])];
  const entriesByGroup = new Map<ComponentGroupId, ComponentEntry[]>();
  for (const filePath of paths) {
    const group = groupOf(filePath);
    if (group === null) {
      continue;
    }
    entriesByGroup.set(group, [
      ...(entriesByGroup.get(group) ?? []),
      {
        path: filePath,
        label: labelOf(filePath, group, inspection),
        override: overrideStates.get(filePath) ?? null,
      },
    ]);
  }
  return groupOrder.flatMap((id): ComponentGroup[] => {
    const entries = entriesByGroup.get(id);
    return entries === undefined
      ? []
      : [
          {
            id,
            ...groupTexts[id],
            entries: entries.toSorted(
              (first, second) =>
                first.label.localeCompare(second.label) ||
                first.path.localeCompare(second.path),
            ),
          },
        ];
  });
}

export function componentLabelFor(
  filePath: string,
  inspection: SiteInspection | null,
): string {
  const group = groupOf(filePath);
  return group === null ? filePath : labelOf(filePath, group, inspection);
}
