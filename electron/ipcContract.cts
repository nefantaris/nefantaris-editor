export type WindowContext =
  { kind: "welcome" } | { kind: "site"; sitePath: string; siteName: string };

export type RecentSite = {
  path: string;
  name: string;
  lastOpenedAt: number;
};

export type SiteValidationFailure =
  "folder-missing" | "config-missing" | "config-unparseable" | "name-missing";

export type OpenSiteResult =
  | { status: "opened"; siteName: string }
  | { status: "cancelled" }
  | { status: "invalid"; path: string; reason: SiteValidationFailure };

export type PageTreeFile = {
  kind: "page";
  title: string;
  fileName: string;
  relativePath: string;
  route: string | null;
};

export type PageTreeFolder = {
  kind: "folder";
  name: string;
  relativePath: string;
  children: PageTreeNode[];
};

export type PageTreeNode = PageTreeFile | PageTreeFolder;

export type PostListEntry = {
  title: string;
  fileName: string;
  relativePath: string;
  route: string | null;
  date: string | null;
  isDraft: boolean;
};

export type ContentTree = {
  pages: PageTreeNode[];
  posts: PostListEntry[];
};

export type ContentMutationFailure =
  "invalid-name" | "already-exists" | "not-found";

export type CreateContentResult =
  | { status: "created"; relativePath: string }
  | { status: "failed"; reason: ContentMutationFailure };

export type RenameContentResult =
  | { status: "renamed"; relativePath: string }
  | { status: "failed"; reason: ContentMutationFailure };

export type DeleteContentResult =
  { status: "deleted" } | { status: "failed"; reason: ContentMutationFailure };

export type ReadContentFileResult =
  { status: "ok"; text: string } | { status: "missing" };

export type SaveAssetResult =
  | { status: "saved"; markdownPath: string }
  | { status: "failed"; reason: "unsupported-type" };

export type SiteNavItem = {
  label: string;
  href: string;
  children?: SiteNavItem[];
};

export type SiteConfig = {
  name: string;
  nav: SiteNavItem[];
  plugins: string[];
};

export type SiteMode = "light" | "dark";

export type ChoiceOption = {
  value: string;
  label: string;
};

export type ThemeSettingOption = ChoiceOption & {
  css: string | null;
};

export type ThemeColorPair = {
  light: string;
  dark: string;
};

type ThemeSettingCommon = {
  label: string;
  description: string | null;
  group: string | null;
};

export type ThemeColorSetting = ThemeSettingCommon & {
  type: "color";
  css: string | null;
  default: ThemeColorPair;
};

export type ThemeSelectSetting = ThemeSettingCommon & {
  type: "select";
  css: string | null;
  options: ThemeSettingOption[];
  default: string;
};

export type ThemeBooleanSetting = ThemeSettingCommon & {
  type: "boolean";
  default: boolean;
};

export type ThemeTextSetting = ThemeSettingCommon & {
  type: "text";
  multiline: boolean;
  default: string;
};

export type ThemeImageSetting = ThemeSettingCommon & {
  type: "image";
  default: string | null;
};

export type ThemeSettingDefinition =
  | ThemeColorSetting
  | ThemeSelectSetting
  | ThemeBooleanSetting
  | ThemeTextSetting
  | ThemeImageSetting;

export type ThemeSettingValue = ThemeColorPair | string | boolean | null;

type BlockAttributeCommon = {
  label: string;
  description: string | null;
  required: boolean;
};

export type BlockTextAttribute = BlockAttributeCommon & {
  type: "text";
  multiline: boolean;
  default: string | null;
  example: string | null;
};

export type BlockSelectAttribute = BlockAttributeCommon & {
  type: "select";
  options: ChoiceOption[];
  default: string | null;
};

export type BlockBooleanAttribute = BlockAttributeCommon & {
  type: "boolean";
  default: boolean | null;
};

export type BlockImageAttribute = BlockAttributeCommon & {
  type: "image";
  alt: string | null;
  default: string | null;
  example: string | null;
};

export type BlockUrlAttribute = BlockAttributeCommon & {
  type: "url";
  default: string | null;
  example: string | null;
};

export type BlockAttribute =
  | BlockTextAttribute
  | BlockSelectAttribute
  | BlockBooleanAttribute
  | BlockImageAttribute
  | BlockUrlAttribute;

export type BlockBody = "markdown" | "images" | "none";

export type BlockText = {
  label: string;
  description: string | null;
  required: boolean;
};

export type BlockSchema = {
  label: string;
  description: string | null;
  body: BlockBody;
  placeholder: string | null;
  text: BlockText | null;
  attributes: Record<string, BlockAttribute>;
  plugin: string | null;
};

export type ThemePart = {
  label: string;
  description: string | null;
};

export type ThemeBreakpoint = {
  name: string;
  minWidth: number;
};

export type InspectedTheme = {
  name: string;
  source: string | null;
  version: string | null;
  dir: string;
  files: string[];
  overrides: string[];
};

export type PluginHeadTag = {
  tag: string;
  attributes: Record<string, string | boolean>;
  when: string | null;
  active: boolean;
};

export type PluginDetail = {
  name: string;
  source: string | null;
  version: string | null;
  requiredByTheme: boolean;
  error: string | null;
  blocks: string[];
  settings: Record<string, ThemeSettingDefinition>;
  settingValues: Record<string, ThemeSettingValue>;
  head: PluginHeadTag[];
  functions: string[];
};

export type SiteInspection = {
  contract: number;
  site: SiteConfig;
  templates: string[];
  directives: string[];
  directiveSchemas: Record<string, BlockSchema> | null;
  plugins: string[];
  pluginDetails: PluginDetail[] | null;
  themeModes: SiteMode[] | null;
  settings: Record<string, ThemeSettingDefinition> | null;
  settingValues: Record<string, ThemeSettingValue>;
  parts: Record<string, ThemePart> | null;
  breakpoints: ThemeBreakpoint[] | null;
  theme: InspectedTheme | null;
  isFallback: boolean;
};

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type SiteConfigPath = (string | number)[];

export type SiteConfigEdit =
  | { kind: "set"; path: SiteConfigPath; value: JsonValue }
  | { kind: "insert"; path: SiteConfigPath; value: JsonValue }
  | { kind: "remove"; path: SiteConfigPath }
  | { kind: "move"; path: SiteConfigPath; from: number; to: number };

export type SiteConfigSnapshot =
  | { status: "ok"; config: JsonObject }
  | { status: "missing" }
  | { status: "unreadable" };

export type SiteImage = {
  assetPath: string;
  fileName: string;
};

export type SiteFavicon = {
  fileName: string;
  modifiedAtMs: number;
};

export type SetFaviconResult =
  | { status: "saved"; favicon: SiteFavicon }
  | { status: "failed"; reason: "unsupported-type" };

export type AddPluginResult =
  | { status: "added"; snapshot: SiteConfigSnapshot }
  | { status: "failed"; message: string };

export type RemovePluginResult =
  | { status: "removed"; snapshot: SiteConfigSnapshot }
  | { status: "failed"; message: string };

export type PluginSettingResult =
  | { status: "saved"; snapshot: SiteConfigSnapshot }
  | { status: "failed"; message: string; snapshot: SiteConfigSnapshot };

export type DevVariable = {
  name: string;
  value: string;
};

export type DevVarsState = {
  variables: DevVariable[];
  isIgnored: boolean;
};

export type PreviewProblem = {
  file: string | null;
  line: number | null;
  detail: string;
};

export type PreviewStatus =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "ready"; url: string; problem: PreviewProblem | null }
  | { state: "error"; message: string; logTail: string };

export type StyleFinding = {
  rule: string;
  message: string;
  line: number | null;
};

export type ThemeStyleToken = {
  name: string;
  value: string;
};

export type StyleScope = "all" | "tablet" | "phone";

export type StyleMediaWidths = {
  tablet: number;
  phone: number;
};

export type StyleDeclaration = {
  property: string;
  value: string;
  isImportant: boolean;
};

export type StyledRule = {
  selector: string;
  key: string;
  scope: StyleScope;
  line: number;
  declarations: StyleDeclaration[];
};

export type StyleRulesState =
  | { status: "ok"; rules: StyledRule[] }
  | { status: "unparseable"; line: number | null };

export type StyleValue = {
  property: string;
  value: string;
};

export type StyleEdit = {
  selector: string;
  scope: StyleScope;
  set: StyleValue[];
  remove: string[];
};

export type StyleEditResult =
  | { status: "saved"; rules: StyledRule[] }
  | { status: "unparseable"; line: number | null }
  | { status: "rejected" };

export type ComponentOverrideState = "current" | "theme-changed" | "untracked";

export type ComponentOverride = {
  path: string;
  state: ComponentOverrideState;
};

export type ComponentListing =
  | {
      status: "ok";
      themeName: string;
      themeVersion: string | null;
      files: string[];
      overrides: ComponentOverride[];
    }
  | { status: "unavailable" };

export type CustomizeComponentResult =
  | { status: "customized" }
  | {
      status: "failed";
      reason: "theme-unavailable" | "not-a-theme-file" | "already-customized";
    };

export type SaveComponentResult = { status: "saved" } | { status: "missing" };

export type ComponentComparison =
  | {
      status: "ok";
      theme: string | null;
      mine: string;
      original: string | null;
      customizedFromVersion: string | null;
      themeVersion: string | null;
    }
  | { status: "missing" };

export type GitSyncSnapshot = {
  connection: "not-connected" | "offline" | "connected";
  isRemoteAhead: boolean;
  isLocalAhead: boolean;
  hasLocalEdits: boolean;
  remoteHead: string | null;
  activity: "idle" | "checking" | "publishing" | "updating";
  hasOpenConflicts: boolean;
};

export type ConflictSideView = {
  exists: boolean;
  text: string | null;
};

export type ConflictFileView = {
  relativePath: string;
  yours: ConflictSideView;
  online: ConflictSideView;
};

export type ConflictChoice = {
  relativePath: string;
  choice: "yours" | "online";
};

export type SyncPurpose = "publish" | "update";

export type SyncActionOutcome =
  | { status: "done" }
  | { status: "nothing-to-publish" }
  | { status: "offline" }
  | { status: "auth-needed" }
  | { status: "not-connected" }
  | { status: "conflicts"; purpose: SyncPurpose; files: ConflictFileView[] }
  | { status: "failed" };

export type SiteVersion = {
  oid: string;
  summary: string;
  note: string | null;
  authorName: string;
  timestampMs: number;
  isUpdateMerge: boolean;
};

export type AuthAccount = {
  login: string;
  name: string | null;
};

export type AuthStatus =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "signed-in"; account: AuthAccount; isSessionOnly: boolean };

export type SignInStart =
  | { status: "started"; userCode: string; verificationUrl: string }
  | { status: "unconfigured" }
  | { status: "failed" };

export type SignInFlowState =
  | { state: "pending" }
  | { state: "success" }
  | { state: "expired" }
  | { state: "error" };

export type GithubRepo = {
  fullName: string;
  cloneUrl: string;
  pushedAtMs: number;
};

export type RepoListResult =
  | { status: "ok"; repos: GithubRepo[] }
  | { status: "auth-needed" }
  | { status: "failed" };

export type RepoCreateResult =
  | { status: "created"; fullName: string; cloneUrl: string }
  | { status: "name-taken" }
  | { status: "auth-needed" }
  | { status: "failed" };

export type NewSitePlan = {
  folderName: string;
  targetPath: string | null;
  isTaken: boolean;
};

export type FirstPartyThemeName =
  "nefantaris-theme-base" | "nefantaris-theme-resume" | "nefantaris-theme-docs";

export type ThemeChoice =
  | { kind: "firstParty"; name: FirstPartyThemeName }
  | { kind: "gitUrl"; url: string };

export type CreateSiteResult =
  | {
      status: "created";
      sitePath: string;
      siteName: string;
      folderName: string;
    }
  | { status: "folder-exists"; path: string }
  | { status: "failed"; message: string };

export type ConnectSiteResult =
  | { status: "connected"; siteName: string }
  | { status: "cancelled" }
  | { status: "folder-exists"; path: string }
  | { status: "invalid"; path: string; reason: SiteValidationFailure }
  | { status: "auth-needed" }
  | { status: "offline" }
  | { status: "failed" };

export type ConnectProgress = {
  targetPath: string;
  phase: string;
  loaded: number;
  total: number | null;
};

export type IpcInvokeMap = {
  "window:getContext": { args: []; result: WindowContext };
  "sites:openFromDialog": { args: []; result: OpenSiteResult };
  "sites:open": { args: [sitePath: string]; result: OpenSiteResult };
  "recentSites:list": { args: []; result: RecentSite[] };
  "recentSites:remove": { args: [sitePath: string]; result: RecentSite[] };
  "content:getTree": { args: [sitePath: string]; result: ContentTree };
  "content:readFile": {
    args: [sitePath: string, relativePath: string];
    result: ReadContentFileResult;
  };
  "content:writeFile": {
    args: [sitePath: string, relativePath: string, text: string];
    result: null;
  };
  "content:createPage": {
    args: [sitePath: string, folderRelativePath: string, title: string];
    result: CreateContentResult;
  };
  "content:createPost": {
    args: [sitePath: string, title: string];
    result: CreateContentResult;
  };
  "content:renameFile": {
    args: [sitePath: string, relativePath: string, newName: string];
    result: RenameContentResult;
  };
  "content:deleteFile": {
    args: [sitePath: string, relativePath: string];
    result: DeleteContentResult;
  };
  "content:saveAsset": {
    args: [
      sitePath: string,
      mimeType: string,
      baseName: string,
      bytes: Uint8Array,
    ];
    result: SaveAssetResult;
  };
  "site:inspect": {
    args: [sitePath: string];
    result: SiteInspection;
  };
  "siteConfig:read": {
    args: [sitePath: string];
    result: SiteConfigSnapshot;
  };
  "siteConfig:edit": {
    args: [sitePath: string, edits: SiteConfigEdit[]];
    result: SiteConfigSnapshot;
  };
  "siteFiles:listImages": {
    args: [sitePath: string];
    result: SiteImage[];
  };
  "siteFiles:getFavicon": {
    args: [sitePath: string];
    result: SiteFavicon | null;
  };
  "siteFiles:setFavicon": {
    args: [
      sitePath: string,
      fileName: string,
      mimeType: string,
      bytes: Uint8Array,
    ];
    result: SetFaviconResult;
  };
  "customCss:read": {
    args: [sitePath: string];
    result: string;
  };
  "customCss:write": {
    args: [sitePath: string, text: string];
    result: null;
  };
  "customCss:findings": {
    args: [sitePath: string];
    result: StyleFinding[];
  };
  "customCss:themeTokens": {
    args: [sitePath: string];
    result: ThemeStyleToken[];
  };
  "styleRules:read": {
    args: [sitePath: string, widths: StyleMediaWidths];
    result: StyleRulesState;
  };
  "styleRules:edit": {
    args: [sitePath: string, widths: StyleMediaWidths, edit: StyleEdit];
    result: StyleEditResult;
  };
  "styleRules:resetTarget": {
    args: [sitePath: string, widths: StyleMediaWidths, selector: string];
    result: StyleEditResult;
  };
  "styleRules:themeTokens": {
    args: [sitePath: string];
    result: ThemeStyleToken[];
  };
  "components:list": {
    args: [sitePath: string];
    result: ComponentListing;
  };
  "components:customize": {
    args: [sitePath: string, filePath: string];
    result: CustomizeComponentResult;
  };
  "components:read": {
    args: [sitePath: string, filePath: string];
    result: ReadContentFileResult;
  };
  "components:write": {
    args: [sitePath: string, filePath: string, text: string];
    result: SaveComponentResult;
  };
  "components:reset": {
    args: [sitePath: string, filePath: string];
    result: null;
  };
  "components:compare": {
    args: [sitePath: string, filePath: string];
    result: ComponentComparison;
  };
  "components:keepMine": {
    args: [sitePath: string, filePath: string];
    result: null;
  };
  "plugins:add": {
    args: [sitePath: string, nameOrAddress: string];
    result: AddPluginResult;
  };
  "plugins:remove": {
    args: [sitePath: string, name: string];
    result: RemovePluginResult;
  };
  "plugins:checkAvailable": {
    args: [name: string];
    result: boolean;
  };
  "plugins:setSetting": {
    args: [sitePath: string, name: string, setting: string, value: JsonValue];
    result: PluginSettingResult;
  };
  "plugins:unsetSetting": {
    args: [sitePath: string, name: string, setting: string];
    result: PluginSettingResult;
  };
  "devVars:read": {
    args: [sitePath: string];
    result: DevVarsState;
  };
  "devVars:write": {
    args: [sitePath: string, variables: DevVariable[]];
    result: null;
  };
  "devVars:ignore": {
    args: [sitePath: string];
    result: DevVarsState;
  };
  "system:openExternal": {
    args: [url: string];
    result: null;
  };
  "clipboard:readText": {
    args: [];
    result: string;
  };
  "preview:start": {
    args: [sitePath: string];
    result: PreviewStatus;
  };
  "preview:stop": {
    args: [sitePath: string];
    result: null;
  };
  "preview:getStatus": {
    args: [sitePath: string];
    result: PreviewStatus;
  };
  "sync:get": {
    args: [sitePath: string];
    result: GitSyncSnapshot;
  };
  "sync:check": {
    args: [sitePath: string];
    result: GitSyncSnapshot;
  };
  "sync:update": {
    args: [sitePath: string];
    result: SyncActionOutcome;
  };
  "publish:run": {
    args: [sitePath: string, note: string | null];
    result: SyncActionOutcome;
  };
  "merge:complete": {
    args: [sitePath: string, choices: ConflictChoice[]];
    result: SyncActionOutcome;
  };
  "merge:cancel": {
    args: [sitePath: string];
    result: null;
  };
  "versions:list": {
    args: [sitePath: string];
    result: SiteVersion[];
  };
  "auth:getStatus": { args: []; result: AuthStatus };
  "auth:startSignIn": { args: []; result: SignInStart };
  "auth:cancelSignIn": { args: []; result: null };
  "auth:signOut": { args: []; result: null };
  "repos:list": { args: []; result: RepoListResult };
  "repos:create": { args: [name: string]; result: RepoCreateResult };
  "sites:connect": {
    args: [cloneUrl: string, repoFullName: string];
    result: ConnectSiteResult;
  };
  "sites:discardClone": { args: [folderPath: string]; result: null };
  "sites:pickCreateParent": { args: []; result: string | null };
  "sites:planCreate": {
    args: [parentFolder: string, siteName: string];
    result: NewSitePlan;
  };
  "sites:create": {
    args: [parentFolder: string, siteName: string, theme: ThemeChoice];
    result: CreateSiteResult;
  };
  "sites:setOnlineRemote": {
    args: [sitePath: string, remoteUrl: string];
    result: null;
  };
  "liveness:check": { args: [url: string]; result: boolean };
};

export type IpcEventMap = {
  "recentSites:changed": RecentSite[];
  "content:changed": { sitePath: string };
  "siteConfig:changed": { sitePath: string };
  "siteFiles:changed": { sitePath: string };
  "customCss:changed": { sitePath: string };
  "components:changed": { sitePath: string };
  "preview:status": { sitePath: string; status: PreviewStatus };
  "sync:changed": { sitePath: string; snapshot: GitSyncSnapshot };
  "auth:statusChanged": AuthStatus;
  "auth:flowChanged": SignInFlowState;
  "connect:progress": ConnectProgress;
};

export type NefantarisApi = {
  invoke: <C extends keyof IpcInvokeMap>(
    channel: C,
    ...args: IpcInvokeMap[C]["args"]
  ) => Promise<IpcInvokeMap[C]["result"]>;
  on: <C extends keyof IpcEventMap>(
    channel: C,
    listener: (payload: IpcEventMap[C]) => void,
  ) => () => void;
};
