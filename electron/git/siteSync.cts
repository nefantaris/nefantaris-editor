import type {
  ConflictChoice,
  ConflictFileView,
  ConflictSideView,
  GitSyncSnapshot,
  SiteVersion,
  SyncActionOutcome,
  SyncPurpose,
} from "../ipcContract.cjs";
import { getStoredAuth } from "../tokenStore.cjs";
import { broadcast } from "../typedIpc.cjs";
import type { ConflictFile, GitIdentity } from "./gitLayer.cjs";
import { gitLayer } from "./gitLayerInstance.cjs";

const FALLBACK_IDENTITY: GitIdentity = {
  name: "Nefantaris Editor",
  email: "editor@nefantaris.local",
};

const UPDATE_MERGE_MESSAGE = "Update from online";
const HISTORY_LIMIT = 50;
const MIN_FETCH_INTERVAL_MS = 3000;

type MergeSession = {
  purpose: SyncPurpose;
  files: ConflictFile[];
};

type SiteSyncState = {
  snapshot: GitSyncSnapshot;
  session: MergeSession | null;
  activity: GitSyncSnapshot["activity"];
  queue: Promise<unknown>;
  lastFetchAt: number;
};

const statesBySitePath = new Map<string, SiteSyncState>();

function initialSnapshot(): GitSyncSnapshot {
  return {
    connection: "not-connected",
    isRemoteAhead: false,
    isLocalAhead: false,
    hasLocalEdits: false,
    remoteHead: null,
    activity: "idle",
    hasOpenConflicts: false,
  };
}

function getState(sitePath: string): SiteSyncState {
  const existing = statesBySitePath.get(sitePath);
  if (existing) {
    return existing;
  }
  const state: SiteSyncState = {
    snapshot: initialSnapshot(),
    session: null,
    activity: "idle",
    queue: Promise.resolve(),
    lastFetchAt: 0,
  };
  statesBySitePath.set(sitePath, state);
  return state;
}

async function settle(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    return;
  }
}

function enqueue<T>(sitePath: string, task: () => Promise<T>): Promise<T> {
  const state = getState(sitePath);
  const previous = state.queue;
  const run = (async () => {
    await settle(previous);
    return task();
  })();
  state.queue = settle(run);
  return run;
}

function publishSnapshot(
  sitePath: string,
  state: SiteSyncState,
  snapshot: GitSyncSnapshot,
): void {
  state.snapshot = snapshot;
  broadcast("sync:changed", { sitePath, snapshot });
}

function setActivity(
  sitePath: string,
  state: SiteSyncState,
  activity: GitSyncSnapshot["activity"],
): void {
  state.activity = activity;
  publishSnapshot(sitePath, state, { ...state.snapshot, activity });
}

async function refreshSnapshot(
  sitePath: string,
  state: SiteSyncState,
  connection?: "connected" | "offline",
): Promise<void> {
  const repo = await gitLayer.getRepoState(sitePath);
  if (repo.kind !== "connected") {
    publishSnapshot(sitePath, state, {
      ...initialSnapshot(),
      activity: state.activity,
      hasOpenConflicts: state.session !== null,
    });
    return;
  }
  const status = await gitLayer.getWorkingTreeStatus(sitePath);
  const position = await gitLayer.getSyncPosition(sitePath);
  const previousConnection = state.snapshot.connection;
  publishSnapshot(sitePath, state, {
    connection:
      connection ??
      (previousConnection === "not-connected"
        ? "connected"
        : previousConnection),
    isRemoteAhead: position.isRemoteAhead,
    isLocalAhead: position.isLocalAhead,
    hasLocalEdits: status.isDirty,
    remoteHead: position.remoteHead,
    activity: state.activity,
    hasOpenConflicts: state.session !== null,
  });
}

function signedInIdentity(): GitIdentity | null {
  const auth = getStoredAuth();
  if (auth === null) {
    return null;
  }
  return { name: auth.name ?? auth.login, email: auth.email };
}

export async function resolveIdentity(sitePath: string): Promise<GitIdentity> {
  return (
    (await gitLayer.getConfiguredIdentity(sitePath)) ??
    signedInIdentity() ??
    FALLBACK_IDENTITY
  );
}

function localStamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${date} ${time}`;
}

function publishCommitMessage(note: string | null): string {
  const subject = `Publish — ${localStamp(new Date())}`;
  const trimmedNote = note?.trim() ?? "";
  return trimmedNote === "" ? subject : `${subject}\n\n${trimmedNote}`;
}

function savedEditsCommitMessage(): string {
  return `Saved edits — ${localStamp(new Date())}`;
}

function sideView(bytes: Uint8Array | null): ConflictSideView {
  if (bytes === null) {
    return { exists: false, text: null };
  }
  if (bytes.subarray(0, 8000).includes(0)) {
    return { exists: true, text: null };
  }
  return { exists: true, text: new TextDecoder().decode(bytes) };
}

function toConflictViews(files: ConflictFile[]): ConflictFileView[] {
  return files.map((file) => ({
    relativePath: file.relativePath,
    yours: sideView(file.ours),
    online: sideView(file.theirs),
  }));
}

function failureOutcome(error: unknown): SyncActionOutcome {
  switch (gitLayer.classifyFailure(error)) {
    case "offline":
      return { status: "offline" };
    case "auth-needed":
      return { status: "auth-needed" };
    default:
      return { status: "failed" };
  }
}

async function fetchTolerantly(
  sitePath: string,
  state: SiteSyncState,
): Promise<SyncActionOutcome | null> {
  try {
    await gitLayer.fetchFromRemote(sitePath);
    state.lastFetchAt = Date.now();
    return null;
  } catch (error) {
    return failureOutcome(error);
  }
}

async function runSyncCycle(
  sitePath: string,
  state: SiteSyncState,
  purpose: SyncPurpose,
  author: GitIdentity,
  retriesLeft: number,
): Promise<SyncActionOutcome> {
  const fetchFailure = await fetchTolerantly(sitePath, state);
  if (fetchFailure !== null) {
    return fetchFailure;
  }
  const position = await gitLayer.getSyncPosition(sitePath);
  if (!position.isRemoteAhead && !position.isLocalAhead) {
    return purpose === "publish"
      ? { status: "nothing-to-publish" }
      : { status: "done" };
  }
  if (position.isRemoteAhead) {
    let attempt;
    try {
      attempt = await gitLayer.mergeFromRemote(
        sitePath,
        UPDATE_MERGE_MESSAGE,
        author,
      );
    } catch (error) {
      return failureOutcome(error);
    }
    if (attempt.kind === "conflicts") {
      state.session = { purpose, files: attempt.files };
      return {
        status: "conflicts",
        purpose,
        files: toConflictViews(attempt.files),
      };
    }
  }
  return pushIfPublishing(sitePath, state, purpose, author, retriesLeft);
}

async function pushIfPublishing(
  sitePath: string,
  state: SiteSyncState,
  purpose: SyncPurpose,
  author: GitIdentity,
  retriesLeft: number,
): Promise<SyncActionOutcome> {
  if (purpose !== "publish") {
    return { status: "done" };
  }
  const position = await gitLayer.getSyncPosition(sitePath);
  if (!position.isLocalAhead) {
    return { status: "done" };
  }
  try {
    await gitLayer.pushToRemote(sitePath);
    return { status: "done" };
  } catch (error) {
    const failure = gitLayer.classifyFailure(error);
    if (failure === "remote-changed" && retriesLeft > 0) {
      return runSyncCycle(sitePath, state, purpose, author, retriesLeft - 1);
    }
    return failureOutcome(error);
  }
}

function connectionHintFor(
  outcome: SyncActionOutcome,
): "connected" | "offline" {
  return outcome.status === "offline" ? "offline" : "connected";
}

async function runAction(
  sitePath: string,
  state: SiteSyncState,
  purpose: SyncPurpose,
  note: string | null,
): Promise<SyncActionOutcome> {
  const repo = await gitLayer.getRepoState(sitePath);
  if (repo.kind !== "connected" || repo.branch === null) {
    await refreshSnapshot(sitePath, state);
    return { status: "not-connected" };
  }
  setActivity(
    sitePath,
    state,
    purpose === "publish" ? "publishing" : "updating",
  );
  let outcome: SyncActionOutcome;
  try {
    const author = await resolveIdentity(sitePath);
    const status = await gitLayer.getWorkingTreeStatus(sitePath);
    if (status.isDirty) {
      await gitLayer.commitAll(
        sitePath,
        purpose === "publish"
          ? publishCommitMessage(note)
          : savedEditsCommitMessage(),
        author,
      );
    }
    outcome = await runSyncCycle(sitePath, state, purpose, author, 1);
  } catch (error) {
    outcome = failureOutcome(error);
  }
  state.activity = "idle";
  await refreshSnapshot(sitePath, state, connectionHintFor(outcome));
  return outcome;
}

export function getSiteSyncSnapshot(
  sitePath: string,
): Promise<GitSyncSnapshot> {
  return enqueue(sitePath, async () => {
    const state = getState(sitePath);
    await refreshSnapshot(sitePath, state);
    return state.snapshot;
  });
}

export function checkSiteSync(sitePath: string): Promise<GitSyncSnapshot> {
  return enqueue(sitePath, async () => {
    const state = getState(sitePath);
    if (state.session !== null || state.activity !== "idle") {
      return state.snapshot;
    }
    const repo = await gitLayer.getRepoState(sitePath);
    if (repo.kind !== "connected" || repo.branch === null) {
      await refreshSnapshot(sitePath, state);
      return state.snapshot;
    }
    if (Date.now() - state.lastFetchAt < MIN_FETCH_INTERVAL_MS) {
      await refreshSnapshot(sitePath, state);
      return state.snapshot;
    }
    setActivity(sitePath, state, "checking");
    let connection: "connected" | "offline" = "connected";
    const fetchFailure = await fetchTolerantly(sitePath, state);
    if (fetchFailure?.status === "offline") {
      connection = "offline";
    }
    if (fetchFailure === null) {
      try {
        const position = await gitLayer.getSyncPosition(sitePath);
        const status = await gitLayer.getWorkingTreeStatus(sitePath);
        if (
          position.isRemoteAhead &&
          !position.isLocalAhead &&
          !status.isDirty
        ) {
          const author = await resolveIdentity(sitePath);
          await gitLayer.mergeFromRemote(
            sitePath,
            UPDATE_MERGE_MESSAGE,
            author,
          );
        }
      } catch {
        connection = "connected";
      }
    }
    state.activity = "idle";
    await refreshSnapshot(sitePath, state, connection);
    return state.snapshot;
  });
}

export function publishSite(
  sitePath: string,
  note: string | null,
): Promise<SyncActionOutcome> {
  return enqueue(sitePath, () =>
    runAction(sitePath, getState(sitePath), "publish", note),
  );
}

export function updateSiteFromOnline(
  sitePath: string,
): Promise<SyncActionOutcome> {
  return enqueue(sitePath, () =>
    runAction(sitePath, getState(sitePath), "update", null),
  );
}

export function completeSiteMerge(
  sitePath: string,
  choices: ConflictChoice[],
): Promise<SyncActionOutcome> {
  return enqueue(sitePath, async () => {
    const state = getState(sitePath);
    const session = state.session;
    if (session === null) {
      return { status: "failed" };
    }
    const choicesByPath = new Map(
      choices.map((choice) => [choice.relativePath, choice.choice]),
    );
    const resolutions = [];
    for (const file of session.files) {
      const choice = choicesByPath.get(file.relativePath);
      if (choice === undefined) {
        return { status: "failed" };
      }
      resolutions.push({
        relativePath: file.relativePath,
        content: choice === "yours" ? file.ours : file.theirs,
      });
    }
    setActivity(
      sitePath,
      state,
      session.purpose === "publish" ? "publishing" : "updating",
    );
    let outcome: SyncActionOutcome;
    try {
      const author = await resolveIdentity(sitePath);
      await gitLayer.completeMergeFromRemote(
        sitePath,
        UPDATE_MERGE_MESSAGE,
        author,
        resolutions,
      );
      state.session = null;
      outcome = await pushIfPublishing(
        sitePath,
        state,
        session.purpose,
        author,
        1,
      );
    } catch (error) {
      outcome = failureOutcome(error);
    }
    state.activity = "idle";
    await refreshSnapshot(sitePath, state, connectionHintFor(outcome));
    return outcome;
  });
}

export function cancelSiteMerge(sitePath: string): Promise<null> {
  return enqueue(sitePath, async () => {
    const state = getState(sitePath);
    state.session = null;
    await refreshSnapshot(sitePath, state);
    return null;
  });
}

export function listSiteVersions(sitePath: string): Promise<SiteVersion[]> {
  return enqueue(sitePath, async () => {
    const entries = await gitLayer.listHistory(sitePath, HISTORY_LIMIT);
    return entries.map((entry) => {
      const message = entry.message.replace(/\n+$/, "");
      const breakAt = message.indexOf("\n");
      const summary = breakAt === -1 ? message : message.slice(0, breakAt);
      const note = breakAt === -1 ? null : message.slice(breakAt).trim();
      return {
        oid: entry.oid,
        summary,
        note: note === "" ? null : note,
        authorName: entry.authorName,
        timestampMs: entry.timestampMs,
        isUpdateMerge: entry.parentCount > 1,
      };
    });
  });
}

export function forgetSiteSync(sitePath: string): void {
  statesBySitePath.delete(sitePath);
}
