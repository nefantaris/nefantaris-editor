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

export type SiteInspection = {
  contract: number;
  site: SiteConfig;
  templates: string[];
  directives: string[];
  plugins: string[];
};

export type PreviewStatus =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "ready"; url: string }
  | { state: "error"; message: string; logTail: string };

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
  "system:openExternal": {
    args: [url: string];
    result: null;
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
  "sites:defaultThemeFolder": { args: []; result: string | null };
  "sites:create": {
    args: [parentFolder: string, siteName: string, themeFolder: string];
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
