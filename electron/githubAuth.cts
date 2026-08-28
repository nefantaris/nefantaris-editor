import type { AuthStatus, SignInStart } from "./ipcContract.cjs";
import {
  canPersistAuth,
  clearAuth,
  getStoredAuth,
  storeAuth,
} from "./tokenStore.cjs";
import { broadcast } from "./typedIpc.cjs";

const PLACEHOLDER_CLIENT_ID = "REPLACE_WITH_GITHUB_CLIENT_ID";
const REQUEST_TIMEOUT_MS = 15_000;
const SLOW_DOWN_EXTRA_MS = 5000;

function envValue(name: string): string | null {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  return value;
}

function resolveClientId(): string {
  return envValue("NEFANTARIS_GITHUB_CLIENT_ID") ?? PLACEHOLDER_CLIENT_ID;
}

export function isSignInConfigured(): boolean {
  return resolveClientId() !== PLACEHOLDER_CLIENT_ID;
}

function oauthBaseUrl(): string {
  return envValue("NEFANTARIS_GITHUB_OAUTH_URL") ?? "https://github.com";
}

export function apiBaseUrl(): string {
  return envValue("NEFANTARIS_GITHUB_API_URL") ?? "https://api.github.com";
}

let flowGeneration = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stringField(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }
  const value: unknown = Reflect.get(payload, key);
  return typeof value === "string" ? value : null;
}

function numberField(payload: unknown, key: string): number | null {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }
  const value: unknown = Reflect.get(payload, key);
  return typeof value === "number" ? value : null;
}

async function postJson(url: string, body: object): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub responded with status ${response.status}`);
  }
  return response.json();
}

type DeviceGrant = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  intervalMs: number;
  expiresAtMs: number;
};

async function requestDeviceGrant(): Promise<DeviceGrant | null> {
  const payload = await postJson(`${oauthBaseUrl()}/login/device/code`, {
    client_id: resolveClientId(),
    scope: "repo",
  });
  const deviceCode = stringField(payload, "device_code");
  const userCode = stringField(payload, "user_code");
  const verificationUrl = stringField(payload, "verification_uri");
  const intervalSeconds = numberField(payload, "interval");
  const expiresInSeconds = numberField(payload, "expires_in");
  if (
    deviceCode === null ||
    userCode === null ||
    verificationUrl === null ||
    intervalSeconds === null ||
    expiresInSeconds === null
  ) {
    return null;
  }
  return {
    deviceCode,
    userCode,
    verificationUrl,
    intervalMs: intervalSeconds * 1000,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  };
}

type TokenPoll =
  | { kind: "pending" }
  | { kind: "slow-down"; intervalMs: number | null }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "token"; token: string };

async function pollTokenOnce(deviceCode: string): Promise<TokenPoll> {
  const payload = await postJson(`${oauthBaseUrl()}/login/oauth/access_token`, {
    client_id: resolveClientId(),
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const token = stringField(payload, "access_token");
  if (token !== null) {
    return { kind: "token", token };
  }
  switch (stringField(payload, "error")) {
    case "authorization_pending":
      return { kind: "pending" };
    case "slow_down": {
      const intervalSeconds = numberField(payload, "interval");
      return {
        kind: "slow-down",
        intervalMs: intervalSeconds === null ? null : intervalSeconds * 1000,
      };
    }
    case "expired_token":
      return { kind: "expired" };
    default:
      return { kind: "denied" };
  }
}

type GithubUser = {
  login: string;
  name: string | null;
  email: string;
};

async function fetchSignedInUser(token: string): Promise<GithubUser | null> {
  const response = await fetch(`${apiBaseUrl()}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    return null;
  }
  const payload: unknown = await response.json();
  const login = stringField(payload, "login");
  const id = numberField(payload, "id");
  if (login === null || id === null) {
    return null;
  }
  const name = stringField(payload, "name");
  const email =
    stringField(payload, "email") ?? `${id}+${login}@users.noreply.github.com`;
  return { login, name, email };
}

export function getAuthStatus(): AuthStatus {
  const auth = getStoredAuth();
  if (auth !== null) {
    return {
      state: "signed-in",
      account: { login: auth.login, name: auth.name },
      isSessionOnly: !canPersistAuth(),
    };
  }
  return isSignInConfigured()
    ? { state: "signed-out" }
    : { state: "unconfigured" };
}

async function finishSignIn(generation: number, token: string): Promise<void> {
  let user: GithubUser | null;
  try {
    user = await fetchSignedInUser(token);
  } catch {
    user = null;
  }
  if (generation !== flowGeneration) {
    return;
  }
  if (user === null) {
    broadcast("auth:flowChanged", { state: "error" });
    return;
  }
  storeAuth({
    token,
    login: user.login,
    name: user.name,
    email: user.email,
  });
  broadcast("auth:flowChanged", { state: "success" });
  broadcast("auth:statusChanged", getAuthStatus());
}

async function pollUntilSignedIn(
  generation: number,
  grant: DeviceGrant,
): Promise<void> {
  let intervalMs = grant.intervalMs;
  while (generation === flowGeneration) {
    await delay(intervalMs);
    if (generation !== flowGeneration) {
      return;
    }
    if (Date.now() > grant.expiresAtMs) {
      broadcast("auth:flowChanged", { state: "expired" });
      return;
    }
    let poll: TokenPoll;
    try {
      poll = await pollTokenOnce(grant.deviceCode);
    } catch {
      if (generation === flowGeneration) {
        broadcast("auth:flowChanged", { state: "error" });
      }
      return;
    }
    if (generation !== flowGeneration) {
      return;
    }
    switch (poll.kind) {
      case "pending":
        break;
      case "slow-down":
        intervalMs = poll.intervalMs ?? intervalMs + SLOW_DOWN_EXTRA_MS;
        break;
      case "expired":
        broadcast("auth:flowChanged", { state: "expired" });
        return;
      case "denied":
        broadcast("auth:flowChanged", { state: "error" });
        return;
      case "token":
        await finishSignIn(generation, poll.token);
        return;
    }
  }
}

export async function startSignIn(): Promise<SignInStart> {
  if (!isSignInConfigured()) {
    return { status: "unconfigured" };
  }
  flowGeneration += 1;
  const generation = flowGeneration;
  let grant: DeviceGrant | null;
  try {
    grant = await requestDeviceGrant();
  } catch {
    grant = null;
  }
  if (generation !== flowGeneration) {
    return { status: "failed" };
  }
  if (grant === null) {
    return { status: "failed" };
  }
  broadcast("auth:flowChanged", { state: "pending" });
  void pollUntilSignedIn(generation, grant);
  return {
    status: "started",
    userCode: grant.userCode,
    verificationUrl: grant.verificationUrl,
  };
}

export function cancelSignIn(): void {
  flowGeneration += 1;
}

export function signOut(): void {
  flowGeneration += 1;
  clearAuth();
  broadcast("auth:statusChanged", getAuthStatus());
}
