import type { TreeEntry } from "isomorphic-git";
import {
  add,
  checkout,
  clone,
  commit,
  currentBranch,
  deleteRef,
  Errors,
  findMergeBase,
  getConfig,
  addRemote as gitAddRemote,
  fetch as gitFetch,
  init,
  listRemotes,
  log,
  merge,
  push,
  readBlob,
  readCommit,
  readTree,
  remove,
  resolveRef,
  statusMatrix,
  writeBlob,
  writeRef,
  writeTree,
} from "isomorphic-git";
import gitHttp from "isomorphic-git/http/node";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CloneProgress,
  ConflictFile,
  GitAuthProvider,
  GitFailure,
  GitIdentity,
  GitLayer,
  HistoryEntry,
  MergeAttempt,
  MergeResolution,
  RepoState,
  SyncPosition,
  WorkingTreeStatus,
} from "./gitLayer.cjs";

const TEMP_OURS_REF = "refs/nefantaris/merge-ours";
const TEMP_THEIRS_REF = "refs/nefantaris/merge-theirs";

class RemoteRefusedPushError extends Error {}

type RemoteTarget = {
  branch: string;
  remoteName: string;
  remoteRef: string;
};

function nodeErrorCode(error: unknown): string | null {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return null;
}

async function readConfigString(
  dir: string,
  key: string,
): Promise<string | null> {
  const value: unknown = await getConfig({ fs, dir, path: key });
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function globalConfigValue(section: string, key: string): string | null {
  const home = os.homedir();
  const xdgConfigHome =
    process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  const candidates = [
    path.join(home, ".gitconfig"),
    path.join(xdgConfigHome, "git", "config"),
  ];
  for (const candidate of candidates) {
    let text: string;
    try {
      text = fs.readFileSync(candidate, "utf8");
    } catch {
      continue;
    }
    const value = configValueFromText(text, section, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function configValueFromText(
  text: string,
  section: string,
  key: string,
): string | null {
  let currentSection = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const sectionMatch = /^\[([^\]]+)\]/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toLowerCase();
      continue;
    }
    if (currentSection !== section) {
      continue;
    }
    const equalsAt = line.indexOf("=");
    if (equalsAt === -1) {
      continue;
    }
    if (line.slice(0, equalsAt).trim().toLowerCase() !== key) {
      continue;
    }
    let value = line.slice(equalsAt + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    return value === "" ? null : value;
  }
  return null;
}

async function resolveRefOrNull(
  dir: string,
  ref: string,
): Promise<string | null> {
  try {
    return await resolveRef({ fs, dir, ref });
  } catch (error) {
    if (error instanceof Errors.NotFoundError) {
      return null;
    }
    throw error;
  }
}

async function readBlobOrNull(
  dir: string,
  commitOid: string,
  filepath: string,
): Promise<Uint8Array | null> {
  try {
    const { blob } = await readBlob({ fs, dir, oid: commitOid, filepath });
    return blob;
  } catch (error) {
    if (error instanceof Errors.NotFoundError) {
      return null;
    }
    throw error;
  }
}

async function remoteTargetOrNull(dir: string): Promise<RemoteTarget | null> {
  const branch = (await currentBranch({ fs, dir })) ?? null;
  if (branch === null) {
    return null;
  }
  const remotes = await listRemotes({ fs, dir });
  const remoteName = remotes[0]?.remote;
  if (remoteName === undefined) {
    return null;
  }
  return {
    branch,
    remoteName,
    remoteRef: `refs/remotes/${remoteName}/${branch}`,
  };
}

async function emptyTreeOid(dir: string): Promise<string> {
  return writeTree({ fs, dir, tree: [] });
}

async function treeWithEntry(
  dir: string,
  treeOid: string,
  segments: string[],
  blobOid: string | null,
): Promise<string | null> {
  const { tree } = await readTree({ fs, dir, oid: treeOid });
  const [head, ...rest] = segments;
  const existing = tree.find((entry) => entry.path === head);
  let nextEntries: TreeEntry[];
  if (rest.length === 0) {
    if (blobOid === null) {
      nextEntries = tree.filter((entry) => entry.path !== head);
    } else {
      const entry: TreeEntry = {
        mode: existing?.type === "blob" ? existing.mode : "100644",
        path: head,
        oid: blobOid,
        type: "blob",
      };
      nextEntries = existing
        ? tree.map((candidate) => (candidate.path === head ? entry : candidate))
        : [...tree, entry];
    }
  } else {
    const childTreeOid =
      existing?.type === "tree" ? existing.oid : await emptyTreeOid(dir);
    const nextChildOid = await treeWithEntry(dir, childTreeOid, rest, blobOid);
    if (nextChildOid === null) {
      nextEntries = tree.filter((entry) => entry.path !== head);
    } else {
      const entry: TreeEntry = {
        mode: "040000",
        path: head,
        oid: nextChildOid,
        type: "tree",
      };
      nextEntries = existing
        ? tree.map((candidate) => (candidate.path === head ? entry : candidate))
        : [...tree, entry];
    }
  }
  if (nextEntries.length === 0) {
    return null;
  }
  return writeTree({ fs, dir, tree: nextEntries });
}

async function treeWithResolutions(
  dir: string,
  treeOid: string,
  resolutions: { relativePath: string; blobOid: string | null }[],
): Promise<string> {
  let current = treeOid;
  for (const resolution of resolutions) {
    const next = await treeWithEntry(
      dir,
      current,
      resolution.relativePath.split("/"),
      resolution.blobOid,
    );
    current = next ?? (await emptyTreeOid(dir));
  }
  return current;
}

async function syncWorkingTree(dir: string, branch: string): Promise<void> {
  try {
    await checkout({ fs, dir, ref: branch });
  } catch (error) {
    if (!(error instanceof Errors.CheckoutConflictError)) {
      throw error;
    }
    const preserved = new Map<string, Buffer>();
    for (const filepath of error.data.filepaths) {
      try {
        preserved.set(filepath, fs.readFileSync(path.join(dir, filepath)));
      } catch {
        continue;
      }
    }
    await checkout({ fs, dir, ref: branch, force: true });
    for (const [filepath, bytes] of preserved) {
      const absolute = path.join(dir, filepath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, bytes);
    }
  }
}

export function createIsomorphicGitLayer(
  authProvider: GitAuthProvider,
): GitLayer {
  const onAuth = async (url: string) => {
    const credentials = await authProvider(url);
    return credentials ?? undefined;
  };

  const initRepo = async (dir: string, defaultBranch: string): Promise<void> =>
    init({ fs, dir, defaultBranch });

  const addRemote = async (
    dir: string,
    remoteName: string,
    url: string,
  ): Promise<void> => gitAddRemote({ fs, dir, remote: remoteName, url });

  const cloneRepo = async (
    url: string,
    dir: string,
    onProgress: (progress: CloneProgress) => void,
  ): Promise<void> => {
    fs.mkdirSync(dir, { recursive: true });
    await clone({
      fs,
      http: gitHttp,
      dir,
      url,
      singleBranch: true,
      onAuth,
      onProgress: (event) => {
        onProgress({
          phase: event.phase,
          loaded: event.loaded,
          total: typeof event.total === "number" ? event.total : null,
        });
      },
    });
  };

  const getRepoState = async (dir: string): Promise<RepoState> => {
    if (!fs.existsSync(path.join(dir, ".git"))) {
      return { kind: "no-repo" };
    }
    const branch = (await currentBranch({ fs, dir })) ?? null;
    const remotes = await listRemotes({ fs, dir });
    const remoteUrl = remotes[0]?.url;
    if (remoteUrl === undefined) {
      return { kind: "no-remote", branch };
    }
    return { kind: "connected", branch, remoteUrl };
  };

  const getWorkingTreeStatus = async (
    dir: string,
  ): Promise<WorkingTreeStatus> => {
    const matrix = await statusMatrix({ fs, dir });
    const changedPaths = matrix
      .filter(
        ([, head, workdir, stage]) =>
          head !== 1 || workdir !== 1 || stage !== 1,
      )
      .map(([filepath]) => filepath);
    return { isDirty: changedPaths.length > 0, changedPaths };
  };

  const getConfiguredIdentity = async (
    dir: string,
  ): Promise<GitIdentity | null> => {
    const name =
      (await readConfigString(dir, "user.name")) ??
      globalConfigValue("user", "name");
    const email =
      (await readConfigString(dir, "user.email")) ??
      globalConfigValue("user", "email");
    if (name === null || email === null) {
      return null;
    }
    return { name, email };
  };

  const commitAll = async (
    dir: string,
    message: string,
    author: GitIdentity,
  ): Promise<boolean> => {
    const matrix = await statusMatrix({ fs, dir });
    let hasChanges = false;
    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === 1 && workdir === 1 && stage === 1) {
        continue;
      }
      hasChanges = true;
      await (workdir === 0
        ? remove({ fs, dir, filepath })
        : add({ fs, dir, filepath }));
    }
    if (!hasChanges) {
      return false;
    }
    await commit({ fs, dir, message, author });
    return true;
  };

  const fetchFromRemote = async (dir: string): Promise<void> => {
    const target = await remoteTargetOrNull(dir);
    if (target === null) {
      return;
    }
    await gitFetch({
      fs,
      http: gitHttp,
      dir,
      remote: target.remoteName,
      ref: target.branch,
      singleBranch: true,
      onAuth,
    });
  };

  const getSyncPosition = async (dir: string): Promise<SyncPosition> => {
    const target = await remoteTargetOrNull(dir);
    const ourOid = await resolveRefOrNull(dir, "HEAD");
    const theirOid = target
      ? await resolveRefOrNull(dir, target.remoteRef)
      : null;
    if (ourOid === null || theirOid === null) {
      return {
        isLocalAhead: ourOid !== null && theirOid === null,
        isRemoteAhead: false,
        remoteHead: theirOid,
      };
    }
    const bases = await findMergeBase({ fs, dir, oids: [ourOid, theirOid] });
    const base = bases[0] ?? null;
    return {
      isLocalAhead: base !== ourOid,
      isRemoteAhead: base !== theirOid,
      remoteHead: theirOid,
    };
  };

  const mergeFromRemote = async (
    dir: string,
    message: string,
    author: GitIdentity,
  ): Promise<MergeAttempt> => {
    const target = await remoteTargetOrNull(dir);
    const ourOid = await resolveRefOrNull(dir, "HEAD");
    const theirOid = target
      ? await resolveRefOrNull(dir, target.remoteRef)
      : null;
    if (target === null || ourOid === null || theirOid === null) {
      return { kind: "up-to-date" };
    }
    const bases = await findMergeBase({ fs, dir, oids: [ourOid, theirOid] });
    const base = bases[0] ?? null;
    if (base === theirOid) {
      return { kind: "up-to-date" };
    }
    if (base === ourOid) {
      await merge({
        fs,
        dir,
        ours: target.branch,
        theirs: target.remoteRef,
        fastForwardOnly: true,
        author,
      });
      await syncWorkingTree(dir, target.branch);
      return { kind: "fast-forwarded" };
    }
    try {
      await merge({
        fs,
        dir,
        ours: target.branch,
        theirs: target.remoteRef,
        abortOnConflict: true,
        message,
        author,
      });
    } catch (error) {
      if (!(error instanceof Errors.MergeConflictError)) {
        throw error;
      }
      const files: ConflictFile[] = [];
      const sortedPaths = error.data.filepaths.toSorted((left, right) =>
        left.localeCompare(right),
      );
      for (const relativePath of sortedPaths) {
        files.push({
          relativePath,
          ours: await readBlobOrNull(dir, ourOid, relativePath),
          theirs: await readBlobOrNull(dir, theirOid, relativePath),
        });
      }
      return { kind: "conflicts", files };
    }
    await syncWorkingTree(dir, target.branch);
    return { kind: "merged" };
  };

  const completeMergeFromRemote = async (
    dir: string,
    message: string,
    author: GitIdentity,
    resolutions: MergeResolution[],
  ): Promise<void> => {
    const target = await remoteTargetOrNull(dir);
    const ourOid = await resolveRefOrNull(dir, "HEAD");
    const theirOid = target
      ? await resolveRefOrNull(dir, target.remoteRef)
      : null;
    if (target === null || ourOid === null || theirOid === null) {
      throw new Error("The merge to finish is no longer available");
    }
    const resolvedBlobs: { relativePath: string; blobOid: string | null }[] =
      [];
    for (const resolution of resolutions) {
      resolvedBlobs.push({
        relativePath: resolution.relativePath,
        blobOid:
          resolution.content === null
            ? null
            : await writeBlob({ fs, dir, blob: resolution.content }),
      });
    }
    const ourCommit = await readCommit({ fs, dir, oid: ourOid });
    const theirCommit = await readCommit({ fs, dir, oid: theirOid });
    const tempOursTree = await treeWithResolutions(
      dir,
      ourCommit.commit.tree,
      resolvedBlobs,
    );
    const tempTheirsTree = await treeWithResolutions(
      dir,
      theirCommit.commit.tree,
      resolvedBlobs,
    );
    const tempOursOid = await commit({
      fs,
      dir,
      message: "Nefantaris merge scaffolding",
      tree: tempOursTree,
      parent: [ourOid],
      noUpdateBranch: true,
      author,
    });
    const tempTheirsOid = await commit({
      fs,
      dir,
      message: "Nefantaris merge scaffolding",
      tree: tempTheirsTree,
      parent: [theirOid],
      noUpdateBranch: true,
      author,
    });
    await writeRef({
      fs,
      dir,
      ref: TEMP_OURS_REF,
      value: tempOursOid,
      force: true,
    });
    await writeRef({
      fs,
      dir,
      ref: TEMP_THEIRS_REF,
      value: tempTheirsOid,
      force: true,
    });
    try {
      const mergeResult = await merge({
        fs,
        dir,
        ours: TEMP_OURS_REF,
        theirs: TEMP_THEIRS_REF,
        noUpdateBranch: true,
        abortOnConflict: true,
        message,
        author,
      });
      if (mergeResult.tree === undefined) {
        throw new Error("The merge did not produce a tree");
      }
      await commit({
        fs,
        dir,
        message,
        tree: mergeResult.tree,
        parent: [ourOid, theirOid],
        author,
      });
    } finally {
      await deleteRef({ fs, dir, ref: TEMP_OURS_REF });
      await deleteRef({ fs, dir, ref: TEMP_THEIRS_REF });
    }
    await syncWorkingTree(dir, target.branch);
  };

  const pushToRemote = async (dir: string): Promise<void> => {
    const target = await remoteTargetOrNull(dir);
    if (target === null) {
      throw new Error("There is no online copy configured for this site");
    }
    const result = await push({
      fs,
      http: gitHttp,
      dir,
      remote: target.remoteName,
      ref: target.branch,
      onAuth,
    });
    const refError = Object.values(result.refs).find((entry) => !entry.ok);
    if (!result.ok || refError) {
      throw new RemoteRefusedPushError(refError?.error ?? "Push refused");
    }
  };

  const listHistory = async (
    dir: string,
    limit: number,
  ): Promise<HistoryEntry[]> => {
    let entries;
    try {
      entries = await log({ fs, dir, depth: limit });
    } catch (error) {
      if (error instanceof Errors.NotFoundError) {
        return [];
      }
      throw error;
    }
    return entries.map((entry) => ({
      oid: entry.oid,
      message: entry.commit.message,
      authorName: entry.commit.author.name,
      timestampMs: entry.commit.author.timestamp * 1000,
      parentCount: entry.commit.parent.length,
    }));
  };

  const classifyFailure = (error: unknown): GitFailure => {
    if (error instanceof Errors.HttpError) {
      const statusCode = error.data.statusCode;
      return statusCode === 401 || statusCode === 403
        ? "auth-needed"
        : "unknown";
    }
    if (error instanceof Errors.UserCanceledError) {
      return "auth-needed";
    }
    if (
      error instanceof Errors.PushRejectedError ||
      error instanceof Errors.GitPushError ||
      error instanceof Errors.NotFoundError ||
      error instanceof RemoteRefusedPushError
    ) {
      return "remote-changed";
    }
    const code = nodeErrorCode(error);
    if (code !== null && /^E[A-Z0-9_]+$/.test(code)) {
      return "offline";
    }
    return "unknown";
  };

  return {
    initRepo,
    addRemote,
    cloneRepo,
    getRepoState,
    getWorkingTreeStatus,
    getConfiguredIdentity,
    commitAll,
    fetchFromRemote,
    getSyncPosition,
    mergeFromRemote,
    completeMergeFromRemote,
    pushToRemote,
    listHistory,
    classifyFailure,
  };
}
