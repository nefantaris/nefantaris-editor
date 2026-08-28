import { apiBaseUrl } from "./githubAuth.cjs";
import type {
  GithubRepo,
  RepoCreateResult,
  RepoListResult,
} from "./ipcContract.cjs";
import { getStoredAuth } from "./tokenStore.cjs";

const REQUEST_TIMEOUT_MS = 30_000;
const REPOS_PER_PAGE = 100;
const REPO_PAGE_LIMIT = 3;

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

function parseRepo(value: unknown): GithubRepo | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const fullName: unknown =
    "full_name" in value ? Reflect.get(value, "full_name") : null;
  const cloneUrl: unknown =
    "clone_url" in value ? Reflect.get(value, "clone_url") : null;
  if (typeof fullName !== "string" || typeof cloneUrl !== "string") {
    return null;
  }
  const pushedAt: unknown =
    "pushed_at" in value ? Reflect.get(value, "pushed_at") : null;
  const pushedAtMs = typeof pushedAt === "string" ? Date.parse(pushedAt) : NaN;
  return {
    fullName,
    cloneUrl,
    pushedAtMs: Number.isNaN(pushedAtMs) ? 0 : pushedAtMs,
  };
}

export async function listUserRepos(): Promise<RepoListResult> {
  const auth = getStoredAuth();
  if (auth === null) {
    return { status: "auth-needed" };
  }
  const repos: GithubRepo[] = [];
  for (let page = 1; page <= REPO_PAGE_LIMIT; page += 1) {
    let response: Response;
    try {
      response = await fetch(
        `${apiBaseUrl()}/user/repos?sort=pushed&per_page=${REPOS_PER_PAGE}&page=${page}`,
        {
          headers: authHeaders(auth.token),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      return { status: "failed" };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: "auth-needed" };
    }
    if (!response.ok) {
      return { status: "failed" };
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return { status: "failed" };
    }
    for (const entry of payload) {
      const repo = parseRepo(entry);
      if (repo !== null) {
        repos.push(repo);
      }
    }
    if (payload.length < REPOS_PER_PAGE) {
      break;
    }
  }
  return { status: "ok", repos };
}

export async function createUserRepo(name: string): Promise<RepoCreateResult> {
  const auth = getStoredAuth();
  if (auth === null) {
    return { status: "auth-needed" };
  }
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/user/repos`, {
      method: "POST",
      headers: {
        ...authHeaders(auth.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, private: true, auto_init: false }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: "failed" };
  }
  if (response.status === 401 || response.status === 403) {
    return { status: "auth-needed" };
  }
  if (response.status === 422) {
    return { status: "name-taken" };
  }
  if (!response.ok) {
    return { status: "failed" };
  }
  const repo = parseRepo(await response.json());
  if (repo === null) {
    return { status: "failed" };
  }
  return {
    status: "created",
    fullName: repo.fullName,
    cloneUrl: repo.cloneUrl,
  };
}
