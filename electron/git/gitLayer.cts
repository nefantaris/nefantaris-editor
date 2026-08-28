export type GitIdentity = {
  name: string;
  email: string;
};

export type GitCredentials = {
  username: string;
  password: string;
};

export type GitAuthProvider = (url: string) => Promise<GitCredentials | null>;

export type RepoState =
  | { kind: "no-repo" }
  | { kind: "no-remote"; branch: string | null }
  | { kind: "connected"; branch: string | null; remoteUrl: string };

export type WorkingTreeStatus = {
  isDirty: boolean;
  changedPaths: string[];
};

export type SyncPosition = {
  isLocalAhead: boolean;
  isRemoteAhead: boolean;
  remoteHead: string | null;
};

export type ConflictFile = {
  relativePath: string;
  ours: Uint8Array | null;
  theirs: Uint8Array | null;
};

export type MergeAttempt =
  | { kind: "up-to-date" }
  | { kind: "fast-forwarded" }
  | { kind: "merged" }
  | { kind: "conflicts"; files: ConflictFile[] };

export type MergeResolution = {
  relativePath: string;
  content: Uint8Array | null;
};

export type HistoryEntry = {
  oid: string;
  message: string;
  authorName: string;
  timestampMs: number;
  parentCount: number;
};

export type GitFailure =
  "offline" | "auth-needed" | "remote-changed" | "unknown";

export type CloneProgress = {
  phase: string;
  loaded: number;
  total: number | null;
};

export type GitLayer = {
  initRepo: (dir: string, defaultBranch: string) => Promise<void>;
  addRemote: (dir: string, remoteName: string, url: string) => Promise<void>;
  cloneRepo: (
    url: string,
    dir: string,
    onProgress: (progress: CloneProgress) => void,
  ) => Promise<void>;
  getRepoState: (dir: string) => Promise<RepoState>;
  getWorkingTreeStatus: (dir: string) => Promise<WorkingTreeStatus>;
  getConfiguredIdentity: (dir: string) => Promise<GitIdentity | null>;
  commitAll: (
    dir: string,
    message: string,
    author: GitIdentity,
  ) => Promise<boolean>;
  fetchFromRemote: (dir: string) => Promise<void>;
  getSyncPosition: (dir: string) => Promise<SyncPosition>;
  mergeFromRemote: (
    dir: string,
    message: string,
    author: GitIdentity,
  ) => Promise<MergeAttempt>;
  completeMergeFromRemote: (
    dir: string,
    message: string,
    author: GitIdentity,
    resolutions: MergeResolution[],
  ) => Promise<void>;
  pushToRemote: (dir: string) => Promise<void>;
  listHistory: (dir: string, limit: number) => Promise<HistoryEntry[]>;
  classifyFailure: (error: unknown) => GitFailure;
};
