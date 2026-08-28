import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { GitAuthProvider } from "./git/gitLayer.cjs";

export type StoredAuth = {
  token: string;
  login: string;
  name: string | null;
  email: string;
};

let memoryAuth: StoredAuth | null = null;
let hasLoadedFromDisk = false;

function authFile(): string {
  return path.join(app.getPath("userData"), "github-auth.bin");
}

export function canPersistAuth(): boolean {
  return safeStorage.isEncryptionAvailable();
}

function isStoredAuth(value: unknown): value is StoredAuth {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    typeof value.token === "string" &&
    "login" in value &&
    typeof value.login === "string" &&
    "name" in value &&
    (value.name === null || typeof value.name === "string") &&
    "email" in value &&
    typeof value.email === "string"
  );
}

function readAuthFromDisk(): StoredAuth | null {
  let encrypted: Buffer;
  try {
    encrypted = fs.readFileSync(authFile());
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(safeStorage.decryptString(encrypted));
    if (isStoredAuth(parsed)) {
      return parsed;
    }
  } catch {
    fs.rmSync(authFile(), { force: true });
    return null;
  }
  fs.rmSync(authFile(), { force: true });
  return null;
}

export function getStoredAuth(): StoredAuth | null {
  if (!hasLoadedFromDisk) {
    hasLoadedFromDisk = true;
    memoryAuth = readAuthFromDisk();
  }
  return memoryAuth;
}

export function storeAuth(auth: StoredAuth): void {
  hasLoadedFromDisk = true;
  memoryAuth = auth;
  if (!canPersistAuth()) {
    return;
  }
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(authFile(), safeStorage.encryptString(JSON.stringify(auth)));
}

export function clearAuth(): void {
  hasLoadedFromDisk = true;
  memoryAuth = null;
  fs.rmSync(authFile(), { force: true });
}

function authorizedGitHosts(): Set<string> {
  const hosts = new Set(["github.com"]);
  const overrides = [
    process.env.NEFANTARIS_GITHUB_OAUTH_URL,
    process.env.NEFANTARIS_GITHUB_API_URL,
  ];
  for (const override of overrides) {
    if (!override) {
      continue;
    }
    try {
      hosts.add(new URL(override).hostname);
    } catch {
      continue;
    }
  }
  return hosts;
}

export const gitAuthProvider: GitAuthProvider = (url) => {
  const auth = getStoredAuth();
  if (auth === null) {
    return Promise.resolve(null);
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return Promise.resolve(null);
  }
  if (!authorizedGitHosts().has(hostname)) {
    return Promise.resolve(null);
  }
  return Promise.resolve({ username: auth.login, password: auth.token });
};
