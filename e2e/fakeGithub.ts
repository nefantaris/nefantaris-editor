import http from "node:http";

export type FakeGithubTokenBehavior = "happy" | "slow-down-once" | "expired";

export type FakeGithubRepo = {
  full_name: string;
  clone_url: string;
  pushed_at: string;
};

export type FakeGithubUser = {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
};

export type FakeGithubOptions = {
  tokenBehavior?: FakeGithubTokenBehavior;
  user?: FakeGithubUser;
  repos?: FakeGithubRepo[];
  takenRepoNames?: string[];
  createdCloneUrlBase?: string;
};

export type FakeGithub = {
  url: string;
  env: Record<string, string>;
  accessToken: string;
  userCode: string;
  tokenPollCount: () => number;
  createdRepoNames: () => string[];
  stop: () => Promise<void>;
};

const ACCESS_TOKEN = "e2e-access-token-9f3a1c";
const USER_CODE = "WDJB-MJHT";
const DEVICE_CODE = "e2e-device-code";

const defaultUser: FakeGithubUser = {
  login: "octo-adam",
  id: 4242,
  name: "Adam Octo",
  email: null,
};

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request: http.IncomingMessage): boolean {
  return (
    request.headers.authorization === `Bearer ${ACCESS_TOKEN}` ||
    request.headers.authorization === `token ${ACCESS_TOKEN}`
  );
}

export async function startFakeGithub(
  options: FakeGithubOptions = {},
): Promise<FakeGithub> {
  const behavior = options.tokenBehavior ?? "happy";
  const user = options.user ?? defaultUser;
  const repos = options.repos ?? [];
  const takenNames = new Set(options.takenRepoNames);
  const createdNames: string[] = [];
  let tokenPolls = 0;
  let baseUrl = "";

  const handleTokenPoll = (response: http.ServerResponse): void => {
    tokenPolls += 1;
    if (behavior === "expired") {
      sendJson(response, 200, { error: "expired_token" });
      return;
    }
    if (behavior === "slow-down-once" && tokenPolls === 1) {
      sendJson(response, 200, { error: "slow_down", interval: 1 });
      return;
    }
    if (behavior === "happy" && tokenPolls === 1) {
      sendJson(response, 200, { error: "authorization_pending" });
      return;
    }
    sendJson(response, 200, {
      access_token: ACCESS_TOKEN,
      token_type: "bearer",
      scope: "repo",
    });
  };

  const handleRepoCreate = async (
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> => {
    const parsed: unknown = JSON.parse(await readBody(request));
    const name =
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof parsed.name === "string"
        ? parsed.name
        : null;
    if (name === null) {
      sendJson(response, 422, { message: "name missing" });
      return;
    }
    if (takenNames.has(name) || createdNames.includes(name)) {
      sendJson(response, 422, {
        message: "name already exists on this account",
      });
      return;
    }
    createdNames.push(name);
    sendJson(response, 201, {
      full_name: `${user.login}/${name}`,
      clone_url: `${options.createdCloneUrlBase ?? baseUrl}/${name}.git`,
      pushed_at: new Date().toISOString(),
    });
  };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const route = `${request.method ?? "GET"} ${url.pathname}`;
    if (route === "POST /login/device/code") {
      sendJson(response, 200, {
        device_code: DEVICE_CODE,
        user_code: USER_CODE,
        verification_uri: `${baseUrl}/login/device`,
        interval: 1,
        expires_in: 900,
      });
      return;
    }
    if (route === "POST /login/oauth/access_token") {
      handleTokenPoll(response);
      return;
    }
    if (!isAuthorized(request)) {
      sendJson(response, 401, { message: "Requires authentication" });
      return;
    }
    if (route === "GET /user") {
      sendJson(response, 200, user);
      return;
    }
    if (route === "GET /user/repos") {
      const perPage = Number(url.searchParams.get("per_page") ?? "30");
      const page = Number(url.searchParams.get("page") ?? "1");
      sendJson(
        response,
        200,
        repos.slice((page - 1) * perPage, page * perPage),
      );
      return;
    }
    if (route === "POST /user/repos") {
      void handleRepoCreate(request, response);
      return;
    }
    sendJson(response, 404, { message: "Not found" });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The fake GitHub server has no port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    url: baseUrl,
    env: {
      NEFANTARIS_GITHUB_CLIENT_ID: "e2e-client-id",
      NEFANTARIS_GITHUB_OAUTH_URL: baseUrl,
      NEFANTARIS_GITHUB_API_URL: baseUrl,
    },
    accessToken: ACCESS_TOKEN,
    userCode: USER_CODE,
    tokenPollCount: () => tokenPolls,
    createdRepoNames: () => [...createdNames],
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

export async function startUnauthorizedGitServer(): Promise<{
  url: string;
  stop: () => Promise<void>;
}> {
  const server = http.createServer((_request, response) => {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="fake"' });
    response.end("Unauthorized");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The unauthorized git server has no port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
