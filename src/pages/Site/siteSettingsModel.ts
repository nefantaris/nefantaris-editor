import type {
  ContentTree,
  JsonObject,
  JsonValue,
  PageTreeNode,
  SiteConfigEdit,
  SiteConfigPath,
  SiteMode,
} from "../../../electron/ipcContract.cts";

export type SiteModeDefault = SiteMode | "system";

export type ModeChoices = {
  offered: SiteMode[];
  defaultMode: SiteModeDefault;
};

export type NavEntryRow = {
  id: string;
  label: string;
  href: string;
  isEditable: boolean;
  tuckedAwayCount: number;
  children: NavEntryRow[];
};

export type LinkOption = {
  key: string;
  route: string;
  label: string;
};

export type LinkOptions = {
  pages: LinkOption[];
  posts: LinkOption[];
};

export type PluginRow = {
  name: string;
  version: string | null;
};

const BLOG_INDEX_ROUTE = "/blog";
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueAt(
  value: JsonValue | undefined,
  path: SiteConfigPath,
): JsonValue | undefined {
  return path.reduce<JsonValue | undefined>((current, segment) => {
    if (typeof segment === "number") {
      return Array.isArray(current) ? current[segment] : undefined;
    }
    return isJsonObject(current) ? current[segment] : undefined;
  }, value);
}

function updatedAt(
  value: JsonValue | undefined,
  path: SiteConfigPath,
  update: ((current: JsonValue | undefined) => JsonValue) | null,
): JsonValue | undefined {
  const [head, ...rest] = path;
  if (head === undefined) {
    return update?.(value);
  }
  if (typeof head === "number") {
    const array = Array.isArray(value) ? value : [];
    const next = updatedAt(array[head], rest, update);
    if (next === undefined) {
      return array.toSpliced(head, 1);
    }
    return head < array.length ? array.with(head, next) : [...array, next];
  }
  const object = isJsonObject(value) ? value : {};
  const next = updatedAt(object[head], rest, update);
  if (next === undefined) {
    return Object.fromEntries(
      Object.entries(object).filter(([key]) => key !== head),
    );
  }
  return { ...object, [head]: next };
}

function applyConfigEdit(config: JsonObject, edit: SiteConfigEdit): JsonValue {
  switch (edit.kind) {
    case "set": {
      return updatedAt(config, edit.path, () => edit.value) ?? config;
    }
    case "insert": {
      const index = edit.path.at(-1);
      return (
        updatedAt(config, edit.path.slice(0, -1), (current) =>
          Array.isArray(current) && typeof index === "number"
            ? current.toSpliced(index, 0, edit.value)
            : [edit.value],
        ) ?? config
      );
    }
    case "remove": {
      return valueAt(config, edit.path) === undefined
        ? config
        : (updatedAt(config, edit.path, null) ?? config);
    }
    case "move": {
      const array = valueAt(config, edit.path);
      if (!Array.isArray(array)) {
        return config;
      }
      const moved = array
        .toSpliced(edit.from, 1)
        .toSpliced(edit.to, 0, array[edit.from]);
      return updatedAt(config, edit.path, () => moved) ?? config;
    }
  }
}

export function applyConfigEdits(
  config: JsonObject,
  edits: SiteConfigEdit[],
): JsonObject {
  return edits.reduce<JsonObject>((current, edit) => {
    const next = applyConfigEdit(current, edit);
    return isJsonObject(next) ? next : current;
  }, config);
}

export function textSetting(config: JsonObject, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

export function textSettingEdits(key: string, value: string): SiteConfigEdit[] {
  return value === ""
    ? [{ kind: "remove", path: [key] }]
    : [{ kind: "set", path: [key], value }];
}

export function siteNameProblem(value: string): string | null {
  return value.trim() === "" ? "Your site needs a name." : null;
}

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const WEB_PROTOCOLS = new Set(["https:", "http:"]);
const OTHER_LINK_PROTOCOLS = new Set(["mailto:", "tel:"]);

export function siteAddressProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const url = parsedUrl(trimmed);
  if (url === null || !WEB_PROTOCOLS.has(url.protocol)) {
    return "Start with https://, like https://example.com.";
  }
  const isBareOrigin =
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "";
  return isBareOrigin
    ? null
    : "Use only the start of the address, with nothing after the domain, like https://example.com.";
}

export function canonicalSiteAddress(value: string): string {
  const url = parsedUrl(value.trim());
  return url === null ? "" : url.origin;
}

function canonicalLanguageOrNull(value: string): string | null {
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null;
  } catch {
    return null;
  }
}

export function languageProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || canonicalLanguageOrNull(trimmed) !== null) {
    return null;
  }
  return "That isn't a language code. Use a short code like en, fr, or pt-BR.";
}

export function canonicalLanguage(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "" : (canonicalLanguageOrNull(trimmed) ?? "");
}

export function linkAddressProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "Every link needs an address.";
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return null;
  }
  const protocol = parsedUrl(trimmed)?.protocol ?? "";
  if (WEB_PROTOCOLS.has(protocol) || OTHER_LINK_PROTOCOLS.has(protocol)) {
    return null;
  }
  return "Start with https:// for another website, or / for a page on this site.";
}

export function linkLabelProblem(value: string): string | null {
  return value.trim() === "" ? "Every link needs a label." : null;
}

function modesObject(config: JsonObject): JsonObject {
  const modes = config.modes;
  return isJsonObject(modes) ? modes : {};
}

function modeListIn(value: JsonValue | undefined): SiteMode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (mode): mode is SiteMode => mode === "light" || mode === "dark",
  );
}

function configuredDefault(modes: JsonObject): SiteModeDefault | null {
  const value = modes.default;
  return value === "light" || value === "dark" || value === "system"
    ? value
    : null;
}

function fitsOffered(
  defaultMode: SiteModeDefault | null,
  offered: SiteMode[],
): defaultMode is SiteModeDefault {
  if (defaultMode === null) {
    return false;
  }
  return defaultMode === "system"
    ? offered.length > 1
    : offered.includes(defaultMode);
}

function impliedDefault(offered: SiteMode[]): SiteModeDefault {
  return offered.length > 1 ? "system" : (offered[0] ?? "light");
}

export function modeChoicesFrom(
  config: JsonObject,
  themeModes: SiteMode[],
): ModeChoices {
  const modes = modesObject(config);
  const excluded = modeListIn(modes.exclude);
  const offered = themeModes.filter((mode) => !excluded.includes(mode));
  const explicit = configuredDefault(modes);
  return {
    offered,
    defaultMode: fitsOffered(explicit, offered)
      ? explicit
      : impliedDefault(offered),
  };
}

function modesEdits(
  config: JsonObject,
  exclude: SiteMode[],
  defaultMode: SiteModeDefault | null,
): SiteConfigEdit[] {
  const modes = modesObject(config);
  const hasOtherKeys = Object.keys(modes).some(
    (key) => key !== "exclude" && key !== "default",
  );
  if (exclude.length === 0 && defaultMode === null && !hasOtherKeys) {
    return "modes" in config ? [{ kind: "remove", path: ["modes"] }] : [];
  }
  const edits: SiteConfigEdit[] = [];
  const currentExclude = modeListIn(modes.exclude);
  if (currentExclude.join(" ") !== exclude.join(" ")) {
    edits.push(
      exclude.length === 0
        ? { kind: "remove", path: ["modes", "exclude"] }
        : { kind: "set", path: ["modes", "exclude"], value: exclude },
    );
  }
  if (configuredDefault(modes) !== defaultMode) {
    edits.push(
      defaultMode === null
        ? { kind: "remove", path: ["modes", "default"] }
        : { kind: "set", path: ["modes", "default"], value: defaultMode },
    );
  }
  return edits;
}

export function offeredModeEdits(
  config: JsonObject,
  themeModes: SiteMode[],
  mode: SiteMode,
  isOffered: boolean,
): SiteConfigEdit[] {
  const current = modeChoicesFrom(config, themeModes);
  const offered = themeModes.filter((candidate) =>
    candidate === mode ? isOffered : current.offered.includes(candidate),
  );
  if (offered.length === 0) {
    return [];
  }
  const explicit = configuredDefault(modesObject(config));
  return modesEdits(
    config,
    themeModes.filter((candidate) => !offered.includes(candidate)),
    fitsOffered(explicit, offered) ? explicit : null,
  );
}

export function defaultModeEdits(
  config: JsonObject,
  defaultMode: SiteModeDefault,
): SiteConfigEdit[] {
  const modes = modesObject(config);
  return modesEdits(config, modeListIn(modes.exclude), defaultMode);
}

function countNavEntries(entries: JsonValue[]): number {
  return entries.reduce<number>((total, entry) => {
    const nested =
      isJsonObject(entry) && Array.isArray(entry.children)
        ? countNavEntries(entry.children)
        : 0;
    return total + 1 + nested;
  }, 0);
}

function navRowFrom(
  entry: JsonValue,
  isTopLevel: boolean,
  makeId: () => string,
): NavEntryRow {
  if (!isJsonObject(entry)) {
    return {
      id: makeId(),
      label: "",
      href: "",
      isEditable: false,
      tuckedAwayCount: 0,
      children: [],
    };
  }
  const childEntries = Array.isArray(entry.children) ? entry.children : [];
  return {
    id: makeId(),
    label: typeof entry.label === "string" ? entry.label : "",
    href: typeof entry.href === "string" ? entry.href : "",
    isEditable: true,
    tuckedAwayCount: isTopLevel ? 0 : countNavEntries(childEntries),
    children: isTopLevel
      ? childEntries.map((child) => navRowFrom(child, false, makeId))
      : [],
  };
}

export function navRowsFrom(
  nav: JsonValue | undefined,
  makeId: () => string,
): NavEntryRow[] {
  return Array.isArray(nav)
    ? nav.map((entry) => navRowFrom(entry, true, makeId))
    : [];
}

function withoutIds(rows: NavEntryRow[]): unknown[] {
  return rows.map(({ id: _id, children, ...rest }) => ({
    ...rest,
    children: withoutIds(children),
  }));
}

export function navSignature(rows: NavEntryRow[]): string {
  return JSON.stringify(withoutIds(rows));
}

function pageOptionsFrom(nodes: PageTreeNode[]): LinkOption[] {
  return nodes.flatMap((node): LinkOption[] => {
    if (node.kind === "folder") {
      return pageOptionsFrom(node.children);
    }
    return node.route === null
      ? []
      : [{ key: node.relativePath, route: node.route, label: node.title }];
  });
}

export function linkOptionsFrom(tree: ContentTree | null): LinkOptions {
  if (tree === null) {
    return { pages: [], posts: [] };
  }
  const posts = tree.posts.flatMap((post): LinkOption[] =>
    post.route === null
      ? []
      : [{ key: post.relativePath, route: post.route, label: post.title }],
  );
  return {
    pages: pageOptionsFrom(tree.pages),
    posts: [
      { key: BLOG_INDEX_ROUTE, route: BLOG_INDEX_ROUTE, label: "All posts" },
      ...posts,
    ],
  };
}

function shortVersion(version: string): string {
  return COMMIT_SHA_PATTERN.test(version) ? version.slice(0, 7) : version;
}

export function pluginRowsFrom(config: JsonObject): PluginRow[] {
  const plugins = config.plugins;
  if (!Array.isArray(plugins)) {
    return [];
  }
  return plugins.flatMap((entry): PluginRow[] => {
    if (typeof entry === "string") {
      return [{ name: entry, version: null }];
    }
    if (isJsonObject(entry) && typeof entry.name === "string") {
      return [
        {
          name: entry.name,
          version:
            typeof entry.version === "string"
              ? shortVersion(entry.version)
              : null,
        },
      ];
    }
    return [];
  });
}
