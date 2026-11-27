import type { ElectronApplication, Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTempDir, launchEditor, stubDirectoryPicker } from "./helpers.ts";

export type FakeCoreMode =
  "serve" | "slow-start" | "crash-once" | "always-crash";

export const fakeInspectTemplates = [
  "fakeSplash",
  "fakeGallery",
  "fakeContact",
];

const fakeCoreCliSource = String.raw`const fs = require("node:fs");
const path = require("node:path");

const [command, ...rest] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function contentRoutes(siteDir) {
  const routes = {};
  const walk = (dir, prefix) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, prefix + entry.name + "/");
      } else if (entry.name.endsWith(".md")) {
        callback(full, prefix + entry.name);
      }
    }
  };
  let callback = () => {};
  const addRoute = (kind) => (full, relative) => {
    const text = fs.readFileSync(full, "utf8");
    const lines = text.split(/\r?\n/);
    let bodyStart = 0;
    let slug = "";
    if (lines[0] === "---") {
      const close = lines.indexOf("---", 1);
      bodyStart = close === -1 ? 0 : close + 1;
      for (const line of lines.slice(1, close)) {
        const match = /^slug:\s*(.+)$/.exec(line);
        if (match) {
          slug = match[1].trim().replace(/^\/+|\/+$/g, "");
        }
      }
    }
    const stem = relative.slice(0, -3);
    let route;
    if (kind === "posts") {
      route = "/blog/" + (slug || stem);
    } else if (slug) {
      route = "/" + slug;
    } else {
      const segments = stem.split("/");
      if (segments[segments.length - 1] === "index") {
        segments.pop();
      }
      route = "/" + segments.join("/");
    }
    routes[route] = {
      file: "content/" + kind + "/" + relative,
      html: renderBody(lines, bodyStart),
    };
  };
  callback = addRoute("pages");
  walk(path.join(siteDir, "content", "pages"), "");
  callback = addRoute("posts");
  walk(path.join(siteDir, "content", "posts"), "");
  return routes;
}

function declaredParts() {
  return JSON.parse(process.env.FAKE_CORE_PARTS ?? "{}");
}

function headingOf(line) {
  return /^(#{1,6}) (.+)$/.exec(line.trim());
}

function renderBody(lines, bodyStart) {
  const parts = [];
  let index = bodyStart;
  while (index < lines.length) {
    const text = lines[index];
    const open = /^(:{3,})([A-Za-z][\w-]*)/.exec(text);
    if (open) {
      const fence = open[1];
      let close = index + 1;
      while (close < lines.length && lines[close].trim() !== fence) {
        close += 1;
      }
      const inner = lines
        .slice(index + 1, close)
        .filter((line) => line.trim() !== "")
        .map(renderInnerLine)
        .join("");
      const partAttribute = Object.hasOwn(declaredParts(), open[2])
        ? " data-part='" + escapeHtml(open[2]) + "'"
        : "";
      parts.push(
        "<div data-nef-line='" + (index + 1) + "' data-directive='" +
          escapeHtml(open[2]) + "'" + partAttribute + ">" + inner + "</div>",
      );
      index = close + 1;
      continue;
    }
    const heading = headingOf(text);
    if (heading) {
      const tag = "h" + heading[1].length;
      parts.push(
        "<" + tag + " data-nef-line='" + (index + 1) + "'>" +
          escapeHtml(heading[2]) + "</" + tag + ">",
      );
    } else if (text.trim() !== "") {
      parts.push(
        "<p data-nef-line='" + (index + 1) + "'>" + escapeHtml(text) + "</p>",
      );
    }
    index += 1;
  }
  return parts.join("");
}

function renderInnerLine(line) {
  const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
  if (image) {
    return (
      "<img alt='" + escapeHtml(image[1]) + "' src='" + escapeHtml(image[2]) +
      "' width='120' height='80' style='display:block;border:1px solid #888'>"
    );
  }
  const heading = headingOf(line);
  if (heading) {
    const tag = "h" + heading[1].length;
    return "<" + tag + ">" + escapeHtml(heading[2]) + "</" + tag + ">";
  }
  return "<span>" + escapeHtml(line) + "</span>";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

function editorPage(siteDir, requestPath) {
  const routes = contentRoutes(siteDir);
  const route =
    requestPath.length > 1 && requestPath.endsWith("/")
      ? requestPath.slice(0, -1)
      : requestPath;
  const page = routes[route];
  const nav = Object.keys(routes)
    .sort()
    .map(
      (key) =>
        "<a data-client-nav href='" + key + "'>" + escapeHtml(key) + "</a>",
    )
    .join(" ");
  const blocks = page ? page.html : "";
  const bridgeScript =
    process.env.FAKE_CORE_NO_BRIDGE === "1"
      ? ""
      : "<script src='/editor/bridge.js'></script>";
  return (
    "<!doctype html><html><head><title>Fake Core</title>" +
    "<style id='fake-custom-css'></style></head><body>" +
    "<nav data-part='nav'>" + nav + "</nav>" +
    "<header data-part='site-header'><h1>Fake Core</h1></header>" +
    "<p id='request-path'>" + escapeHtml(route) + "</p>" +
    "<main data-part='content' id='content' tabindex='-1'>" + blocks + "</main>" +
    "<button id='send-foreign'>Send foreign messages</button>" +
    "<script>window.__fakeRoutes = " +
    JSON.stringify(routes).replace(/</g, "\\u003c") +
    ";</script>" + bridgeScript + "</body></html>"
  );
}

let buildError = null;

function runtimeErrorOf(siteDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(siteDir, ".fake-core-runtime-error"), "utf8"),
    );
  } catch {
    return null;
  }
}

function previewState(siteDir) {
  let css = "";
  try {
    css = fs.readFileSync(path.join(siteDir, "custom.css"), "utf8");
  } catch {}
  const runtime = runtimeErrorOf(siteDir);
  return {
    css,
    error:
      buildError ??
      (runtime === null
        ? null
        : {
            kind: "runtime",
            message: runtime.message,
            file: runtime.file ?? null,
            line: runtime.line ?? null,
            column: runtime.line ? 1 : null,
          }),
  };
}

function runDev(rawArgs) {
  const http = require("node:http");
  const isEditor = rawArgs.includes("--editor");
  const args = rawArgs.filter((arg) => arg !== "--editor");
  const [siteDir, portFlag, portValue, strictFlag] = args;
  if (!siteDir || portFlag !== "--port" || !portValue || strictFlag !== "--strictPort") {
    fail("fake core: unexpected dev arguments: " + rawArgs.join(" "));
  }

  const port = Number(portValue);
  const modePath = path.join(siteDir, ".fake-core-mode");
  const crashMarkerPath = path.join(siteDir, ".fake-core-crashed");

  function readMode() {
    try {
      return fs.readFileSync(modePath, "utf8").trim();
    } catch {
      return "serve";
    }
  }

  const server = http.createServer((request, response) => {
    const requestPath = new URL(request.url, "http://localhost").pathname;
    if (isEditor && requestPath === "/__fake/state") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(previewState(siteDir)));
      return;
    }
    if (isEditor && requestPath === "/editor/bridge.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(fs.readFileSync(path.join(__dirname, "fakeBridge.js"), "utf8"));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      isEditor
        ? editorPage(siteDir, requestPath)
        : "<!doctype html><html><head><title>Fake Core</title></head><body>" +
            "<h1>Fake Core</h1><p id='request-path'>" +
            request.url +
            "</p></body></html>",
    );
    const mode = readMode();
    if (mode === "always-crash") {
      setTimeout(() => process.exit(1), 20);
      return;
    }
    if (mode === "crash-once" && !fs.existsSync(crashMarkerPath)) {
      fs.writeFileSync(crashMarkerPath, "crashed");
      setTimeout(() => process.exit(1), 20);
    }
  });

  if (isEditor) {
    watchCustomCode(siteDir);
  }

  const startDelay = readMode() === "slow-start" ? 1500 : 0;
  setTimeout(() => {
    server.listen(port, () => {
      console.log("fake core listening on " + port);
    });
  }, startDelay);
}

function watchCustomCode(siteDir) {
  const timers = new Map();
  const report = (relative) => {
    const full = path.join(siteDir, relative);
    if (relative === "custom.css") {
      console.log("12:00:00 AM [vite] (client) hmr update /src/app.css");
      return;
    }
    const themePath = relative.slice("child-theme/".length);
    let text = "";
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {}
    const generated = path.join(siteDir, ".nefantaris", "src", "theme", themePath);
    if (text.includes("<<<")) {
      const brokenLine = text.split("\n").findIndex((entry) => entry.includes("<<<"));
      buildError = {
        kind: "build",
        message: "Transform failed with 1 error:\n\n[PARSE_ERROR] Unexpected token",
        file: relative,
        line: brokenLine + 1,
        column: 1,
      };
      console.error(
        "12:00:00 AM [vite] Internal server error: Transform failed with 1 error:\n\n" +
          "[PARSE_ERROR] Unexpected token\n" +
          "  Plugin: vite:oxc\n" +
          "  File: " + generated + "\n" +
          "      at transformWithOxc (file:///fake/node.js:1:1)",
      );
      return;
    }
    if (buildError !== null && buildError.file === relative) {
      buildError = null;
    }
    console.log(
      "12:00:00 AM [vite] (client) hmr update /src/app.css, /src/theme/" + themePath,
    );
  };
  try {
    fs.watch(siteDir, { recursive: true }, (_event, fileName) => {
      if (typeof fileName !== "string") {
        return;
      }
      const relative = fileName.split(path.sep).join("/");
      const isChildThemeFile =
        relative.startsWith("child-theme/") &&
        !relative.split("/").some((segment) => segment.startsWith("."));
      if (relative !== "custom.css" && !isChildThemeFile) {
        return;
      }
      clearTimeout(timers.get(relative));
      timers.set(relative, setTimeout(() => report(relative), 100));
    });
  } catch {}
}

const skippedThemeNames = new Set([
  "node_modules",
  "tsconfig.json",
  "README.md",
  "LICENSE",
]);

function collectThemeFiles(dir, prefix) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => !entry.name.startsWith(".") && !skippedThemeNames.has(entry.name))
    .flatMap((entry) => {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) {
        return collectThemeFiles(path.join(dir, entry.name), relative + "/");
      }
      return entry.isFile() ? [relative] : [];
    })
    .sort();
}

function inspectedTheme(siteDir, config) {
  const source = config.theme && config.theme.source;
  if (typeof source !== "string") {
    return null;
  }
  const dir = path.resolve(siteDir, source);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return null;
  }
  let name = path.basename(dir);
  try {
    name = JSON.parse(fs.readFileSync(path.join(dir, "theme.json"), "utf8")).name || name;
  } catch {}
  return {
    name,
    source,
    version: config.theme.version ?? "local",
    dir,
    files: collectThemeFiles(dir, ""),
    overrides: collectThemeFiles(path.join(siteDir, "child-theme"), ""),
  };
}

function runDoctor(args) {
  const [siteDir, jsonFlag] = args;
  if (!siteDir || jsonFlag !== "--json") {
    fail("fake core: unexpected doctor arguments: " + args.join(" "));
  }
  const parts = JSON.parse(process.env.FAKE_CORE_PARTS ?? "{}");
  let css = "";
  try {
    css = fs.readFileSync(path.join(siteDir, "custom.css"), "utf8");
  } catch {}
  const findings = [];
  css
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(/\[data-part=["']?([\w-]+)["']?\]/g)) {
        if (!Object.hasOwn(parts, match[1])) {
          findings.push({
            severity: "advice",
            rule: "styles/unknown-part",
            message:
              "[data-part=\"" + match[1] + "\"] is not a part theme \"fake-theme\" declares; if the theme renamed or removed it, this rule no longer matches anything.",
            file: "custom.css",
            line: index + 1,
          });
        }
      }
    });
  console.log(
    JSON.stringify({ contract: 1, errors: [], advice: findings, findings }),
  );
}

function runInspect(args) {
  const [siteDir, jsonFlag] = args;
  if (!siteDir || jsonFlag !== "--json") {
    fail("fake core: unexpected inspect arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_INSPECT_BEHAVIOR === "fail") {
    fail("fake core: inspect failed on purpose");
  }
  let config = {};
  try {
    config = JSON.parse(
      fs.readFileSync(path.join(siteDir, "nefantaris.json"), "utf8"),
    );
  } catch {}
  const name = typeof config.name === "string" ? config.name : "Fake Site";
  const themeModes = JSON.parse(
    process.env.FAKE_CORE_THEME_MODES ?? '["light"]',
  );
  const excluded =
    config.modes && Array.isArray(config.modes.exclude)
      ? config.modes.exclude
      : [];
  const available = themeModes.filter((mode) => !excluded.includes(mode));
  const configuredDefault = config.modes ? config.modes.default : undefined;
  const modes = {
    available,
    default:
      configuredDefault ?? (available.length > 1 ? "system" : available[0]),
  };
  const directiveSchemas = JSON.parse(
    process.env.FAKE_CORE_DIRECTIVE_SCHEMAS ?? "null",
  );
  const pluginNames = pluginEntriesOf(config).map(pluginNameOf);
  const inspection = {
    contract: 1,
    site: { name, nav: [], plugins: pluginNames },
    templates: ["fakeSplash", "fakeGallery", "fakeContact"],
    directives: directiveSchemas ? Object.keys(directiveSchemas) : ["fakeNote"],
    plugins: pluginNames,
    modes,
  };
  if (process.env.FAKE_CORE_INSPECT_SHAPE === "0.4.5") {
    console.log(JSON.stringify(inspection));
    return;
  }
  const settings = JSON.parse(process.env.FAKE_CORE_SETTINGS ?? "{}");
  const theme = inspectedTheme(siteDir, config);
  const stored =
    config.theme && typeof config.theme.settings === "object"
      ? config.theme.settings ?? {}
      : {};
  console.log(
    JSON.stringify({
      ...inspection,
      directiveSchemas: directiveSchemas ?? {
        fakeNote: {
          label: "fakeNote",
          description: null,
          body: "markdown",
          placeholder: null,
          attributes: {},
        },
      },
      modes: {
        ...modes,
        declared: JSON.parse(
          process.env.FAKE_CORE_DECLARED_MODES ?? JSON.stringify(themeModes),
        ),
      },
      settings,
      settingValues: resolveSettings(settings, stored),
      pluginDetails: pluginEntriesOf(config).map(pluginDetailOf),
      parts: JSON.parse(process.env.FAKE_CORE_PARTS ?? "{}"),
      breakpoints: JSON.parse(
        process.env.FAKE_CORE_BREAKPOINTS ??
          JSON.stringify([
            { name: "sm", minWidth: 640 },
            { name: "md", minWidth: 768 },
            { name: "lg", minWidth: 1024 },
            { name: "xl", minWidth: 1280 },
            { name: "2xl", minWidth: 1536 },
          ]),
      ),
      ...(theme === null ? {} : { theme }),
    }),
  );
}

function pluginEntriesOf(config) {
  return Array.isArray(config.plugins) ? config.plugins : [];
}

function pluginNameOf(entry) {
  return typeof entry === "string" ? entry : entry.name;
}

function themeRequires() {
  return JSON.parse(process.env.FAKE_CORE_THEME_REQUIRES ?? "[]");
}

function declaredPluginOf(name) {
  const declared = JSON.parse(process.env.FAKE_CORE_PLUGIN_DETAILS ?? "{}");
  return Object.hasOwn(declared, name) ? declared[name] : {};
}

function storedPluginSettingsOf(entry) {
  return typeof entry === "object" &&
    entry.settings &&
    typeof entry.settings === "object"
    ? entry.settings
    : {};
}

function isSettingFilled(definition, value) {
  if (definition === undefined) {
    return false;
  }
  if (definition.type === "boolean") {
    return value === true;
  }
  if (definition.type === "text") {
    return typeof value === "string" && value.trim() !== "";
  }
  if (definition.type === "image") {
    return typeof value === "string";
  }
  return true;
}

function isHeadTagActive(tag, settings, values) {
  const named = tag.when ? [tag.when] : [];
  for (const value of Object.values(tag.attributes ?? {})) {
    if (typeof value === "string") {
      for (const match of value.matchAll(/\{\{(\w+)\}\}/g)) {
        named.push(match[1]);
      }
    }
  }
  return named.every((name) => isSettingFilled(settings[name], values[name]));
}

function pluginDetailOf(entry) {
  const name = pluginNameOf(entry);
  const declared = declaredPluginOf(name);
  const error = declared.error ?? null;
  const settings = error === null ? declared.settings ?? {} : {};
  const settingValues = resolveSettings(settings, storedPluginSettingsOf(entry));
  return {
    name,
    source: typeof entry === "string" ? null : entry.source ?? null,
    version: typeof entry === "string" ? null : entry.version ?? null,
    requiredByTheme: themeRequires().includes(name),
    error,
    blocks: error === null ? declared.blocks ?? [] : [],
    settings,
    settingValues,
    head:
      error === null
        ? (declared.head ?? []).map((tag) => ({
            tag: tag.tag,
            attributes: tag.attributes ?? {},
            when: tag.when ?? null,
            active: isHeadTagActive(tag, settings, settingValues),
          }))
        : [],
    functions: error === null ? declared.functions ?? [] : [],
  };
}

const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function resolveColor(definition, value) {
  if (typeof value === "string") {
    return hexColor.test(value) ? { light: value, dark: value } : definition.default;
  }
  const resolved = { ...definition.default };
  for (const mode of ["light", "dark"]) {
    if (value && typeof value === "object" && hexColor.test(value[mode] ?? "")) {
      resolved[mode] = value[mode];
    }
  }
  return resolved;
}

function acceptsValue(definition, value) {
  if (definition.type === "select") {
    return definition.options.some((option) => option.value === value);
  }
  if (definition.type === "boolean") {
    return typeof value === "boolean";
  }
  if (definition.type === "text") {
    return typeof value === "string";
  }
  return value === null || (typeof value === "string" && value.startsWith("/"));
}

function resolveSettings(settings, stored) {
  const values = {};
  for (const [name, definition] of Object.entries(settings)) {
    const value = stored[name];
    if (value === undefined) {
      values[name] = definition.default;
    } else if (definition.type === "color") {
      values[name] = resolveColor(definition, value);
    } else {
      values[name] = acceptsValue(definition, value) ? value : definition.default;
    }
  }
  return values;
}

function parsedSettingValue(definition, text) {
  if (definition.type === "boolean") {
    return text === "true" || text === "false" ? text === "true" : text;
  }
  if (definition.type === "color" && text.trimStart().startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function acceptsSettingValue(definition, value) {
  if (definition.type !== "color") {
    return acceptsValue(definition, value);
  }
  if (typeof value === "string") {
    return hexColor.test(value);
  }
  return (
    typeof value === "object" &&
    value !== null &&
    Object.entries(value).every(
      ([mode, modeValue]) =>
        (mode === "light" || mode === "dark") && hexColor.test(modeValue),
    )
  );
}

function entryWithSettings(entry, settings) {
  const base =
    typeof entry === "string"
      ? { name: entry }
      : Object.fromEntries(
          Object.entries(entry).filter(([key]) => key !== "settings"),
        );
  if (Object.keys(settings).length > 0) {
    return { ...base, settings };
  }
  return Object.keys(base).length === 1 ? base.name : base;
}

function runPluginSetting(subcommand, args) {
  const [name, setting, ...rest] = args;
  const value = subcommand === "set" ? rest[0] : undefined;
  const siteDir = subcommand === "set" ? rest[1] : rest[0];
  if (!name || !setting || !siteDir || (subcommand === "set" && value === undefined)) {
    fail("fake core: unexpected plugins arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_PLUGINS_BEHAVIOR === "fail") {
    fail("fake core: the add-on's settings file is missing");
  }
  if (process.env.FAKE_CORE_COMMAND_LOG) {
    fs.appendFileSync(
      process.env.FAKE_CORE_COMMAND_LOG,
      JSON.stringify(
        [subcommand, name, setting].concat(value === undefined ? [] : [value]),
      ) + "\n",
    );
  }
  const configPath = path.join(siteDir, "nefantaris.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const plugins = pluginEntriesOf(config);
  const index = plugins.findIndex((entry) => pluginNameOf(entry) === name);
  if (index === -1) {
    fail(configPath + ' does not enable "' + name + '"');
  }
  const settings = { ...storedPluginSettingsOf(plugins[index]) };
  if (subcommand === "unset") {
    delete settings[setting];
  } else {
    const definition = (declaredPluginOf(name).settings ?? {})[setting];
    if (definition === undefined) {
      fail('Plugin "' + name + '" has no "' + setting + '" setting');
    }
    const parsed = parsedSettingValue(definition, value);
    if (!acceptsSettingValue(definition, parsed)) {
      fail(
        '"plugins[' + index + "].settings." + setting + '": ' +
          JSON.stringify(parsed) + " is not accepted, so nothing was written",
      );
    }
    settings[setting] = parsed;
  }
  const written = plugins.map((entry, entryIndex) =>
    entryIndex === index ? entryWithSettings(entry, settings) : entry,
  );
  fs.writeFileSync(
    configPath,
    JSON.stringify({ ...config, plugins: written }, null, 4) + "\n",
  );
}

function runPlugins(args) {
  if (args[0] === "set" || args[0] === "unset") {
    runPluginSetting(args[0], args.slice(1));
    return;
  }
  const [subcommand, name, siteDir, ...flagArgs] = args;
  const options = {};
  for (let index = 0; index < flagArgs.length; index += 2) {
    options[flagArgs[index]] = flagArgs[index + 1];
  }
  if (!["add", "remove"].includes(subcommand) || !name || !siteDir) {
    fail("fake core: unexpected plugins arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_PLUGINS_BEHAVIOR === "fail") {
    fail("fake core: the add-on's settings file is missing");
  }
  const configPath = path.join(siteDir, "nefantaris.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const plugins = pluginEntriesOf(config);
  if (subcommand === "remove") {
    removePlugin(configPath, config, name);
    return;
  }
  const entry = options["--source"]
    ? { name, source: options["--source"], version: options["--version"] }
    : name;
  fs.writeFileSync(
    configPath,
    JSON.stringify({ ...config, plugins: [...plugins, entry] }, null, 4) + "\n",
  );
  console.log("Added " + name);
}

function removePlugin(configPath, config, name) {
  if (themeRequires().includes(name)) {
    fail(
      configPath +
        ': theme "fake-theme" requires the plugin "' +
        name +
        '", so it stays enabled while the site uses this theme',
    );
  }
  const plugins = pluginEntriesOf(config);
  const remaining = plugins.filter((entry) => pluginNameOf(entry) !== name);
  if (remaining.length === plugins.length) {
    console.log(configPath + ' does not enable "' + name + '"');
    return;
  }
  fs.writeFileSync(
    configPath,
    JSON.stringify({ ...config, plugins: remaining }, null, 4) + "\n",
  );
  console.log("Removed " + name);
}

function runInit(args) {
  const [siteDir, ...flagArgs] = args;
  const options = {};
  for (let index = 0; index < flagArgs.length; index += 2) {
    options[flagArgs[index]] = flagArgs[index + 1];
  }
  const themeSource = options["--theme"];
  if (!siteDir || !themeSource) {
    fail("fake core: unexpected init arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_INIT_BEHAVIOR === "fail") {
    fs.mkdirSync(path.join(siteDir, "content"), { recursive: true });
    fail("fake core: init failed on purpose");
  }
  fs.mkdirSync(path.join(siteDir, "content", "pages"), { recursive: true });
  fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(siteDir, "nefantaris.json"),
    JSON.stringify(
      {
        name: options["--name"] ?? path.basename(siteDir),
        theme: {
          source: themeSource,
          version: options["--theme-version"] ?? "local",
        },
        plugins: JSON.parse(process.env.FAKE_CORE_INIT_PLUGINS ?? "[]"),
      },
      null,
      4,
    ) + "\n",
  );
  fs.writeFileSync(
    path.join(siteDir, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  fs.writeFileSync(path.join(siteDir, "assets", ".gitkeep"), "");
}

if (command === "dev") {
  runDev(rest);
} else if (command === "inspect") {
  runInspect(rest);
} else if (command === "init") {
  runInit(rest);
} else if (command === "plugins") {
  runPlugins(rest);
} else if (command === "doctor") {
  runDoctor(rest);
} else {
  fail("fake core: unexpected command: " + String(command));
}
`;

const fakeBridgeSource = `(function () {
  if (window.parent === window) {
    return;
  }
  var routes = window.__fakeRoutes || {};
  var isSelecting = false;
  var highlightSelector = null;
  var reportedWidth = window.innerWidth;
  var lastCss = null;
  var lastError = "null";
  var styleKeys = [
    "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "text-transform", "text-align", "text-decoration-line",
    "color", "background-color", "background-image",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "width", "max-width", "height", "display", "row-gap", "column-gap",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius",
    "border-bottom-right-radius", "border-bottom-left-radius",
    "opacity", "box-shadow"
  ];

  function currentRoute() {
    var pathname = window.location.pathname;
    return pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  }

  function fileOf(route) {
    return routes[route] ? routes[route].file : null;
  }

  function post(type, payload) {
    var message = { type: "nefantaris:" + type, protocol: 1 };
    Object.keys(payload).forEach(function (key) {
      message[key] = payload[key];
    });
    window.parent.postMessage(message, "*");
  }

  function routePayload() {
    return { route: currentRoute(), file: fileOf(currentRoute()) };
  }

  function render(route) {
    var page = routes[route];
    document.getElementById("content").innerHTML = page ? page.html : "";
    document.getElementById("request-path").textContent = route;
  }

  function setSelecting(active) {
    isSelecting = active;
    document.body.dataset.selecting = String(active);
    post("select-mode", { active: active });
  }

  function computedStyles(element) {
    var computed = getComputedStyle(element);
    var styles = {};
    styleKeys.forEach(function (key) {
      styles[key] = computed.getPropertyValue(key);
    });
    return styles;
  }

  function partChain(element) {
    var parts = [];
    for (var current = element; current !== null; current = current.parentElement) {
      if (current.dataset && current.dataset.part) {
        parts.unshift(current.dataset.part);
      }
    }
    return parts;
  }

  function partSelector(part) {
    return '[data-part="' + part + '"]';
  }

  function suggestedSelectors(element, parts) {
    var tag = element.localName;
    var ownPart = element.dataset ? element.dataset.part : undefined;
    var enclosing = (ownPart ? parts.slice(0, -1) : parts.slice()).reverse();
    var selectors = [];
    if (ownPart) {
      selectors.push(partSelector(ownPart));
    }
    enclosing.forEach(function (part) {
      selectors.push(partSelector(part) + " " + tag);
    });
    selectors.push(tag);
    return selectors.filter(function (selector, index) {
      return selectors.indexOf(selector) === index;
    });
  }

  function matching(selector) {
    try {
      return Array.prototype.slice.call(document.querySelectorAll(selector));
    } catch (error) {
      return null;
    }
  }

  function summary(matches) {
    return {
      count: matches ? matches.length : 0,
      valid: matches !== null,
      visible: matches
        ? matches.filter(function (element) {
            return element.checkVisibility({ visibilityProperty: true });
          }).length
        : 0,
    };
  }

  function highlight(selector) {
    highlightSelector = selector;
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-fake-highlight]"),
      function (element) {
        element.removeAttribute("data-fake-highlight");
      }
    );
    var matches = selector === null ? [] : matching(selector);
    (matches || []).forEach(function (element) {
      element.setAttribute("data-fake-highlight", "");
    });
    reportHighlight();
  }

  function reportHighlight() {
    var payload = summary(highlightSelector === null ? [] : matching(highlightSelector));
    payload.selector = highlightSelector;
    post("highlighted", payload);
  }

  function inspect(selector) {
    var matches = matching(selector);
    var payload = summary(matches);
    payload.selector = selector;
    payload.styles = matches && matches.length > 0 ? computedStyles(matches[0]) : null;
    payload.viewportWidth = window.innerWidth;
    post("inspected", payload);
  }

  function sendForeignMessages() {
    window.parent.postMessage(
      { type: "nefantaris:selected", protocol: 2, route: "/secret", file: "content/pages/secret.md", line: 4 },
      "*"
    );
    window.parent.postMessage(
      { type: "nefantaris:selected", protocol: 1, route: "/secret", file: "../secret.md", line: 4 },
      "*"
    );
    window.parent.postMessage(
      { type: "other:selected", protocol: 1, route: "/secret", file: "content/pages/secret.md", line: 4 },
      "*"
    );
    window.parent.postMessage(
      { type: "nefantaris:route", protocol: 1, route: "/secret", file: "content/pages/secret.md" },
      "http://localhost:1"
    );
    var nested = document.createElement("iframe");
    nested.srcdoc =
      "<script>parent.parent.postMessage({ type: 'nefantaris:selected', protocol: 1, route: '/secret', file: 'content/pages/secret.md', line: 4 }, '*');" +
      "parent.parent.postMessage({ type: 'nefantaris:route', protocol: 1, route: '/secret', file: 'content/pages/secret.md' }, '*');<" +
      "/script>";
    document.body.appendChild(nested);
  }

  function pollState() {
    fetch("/__fake/state", { cache: "no-store" })
      .then(function (response) {
        return response.json();
      })
      .then(function (state) {
        if (state.css !== lastCss) {
          lastCss = state.css;
          document.getElementById("fake-custom-css").textContent = state.css;
        }
        var error = JSON.stringify(state.error);
        if (error !== lastError) {
          lastError = error;
          if (state.error === null) {
            post("error-cleared", {});
          } else {
            post("error", state.error);
            post("error", state.error);
          }
        }
      })
      .catch(function () {})
      .finally(function () {
        setTimeout(pollState, 120);
      });
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) {
      return;
    }
    var data = event.data;
    if (!data || data.protocol !== 1) {
      return;
    }
    if (data.type === "nefantaris:ping") {
      var ready = routePayload();
      ready.viewportWidth = window.innerWidth;
      post("ready", ready);
    } else if (data.type === "nefantaris:select-mode" && typeof data.active === "boolean") {
      setSelecting(data.active);
    } else if (
      data.type === "nefantaris:highlight" &&
      (typeof data.selector === "string" || data.selector === null)
    ) {
      highlight(data.selector);
    } else if (data.type === "nefantaris:inspect-selector" && typeof data.selector === "string") {
      inspect(data.selector);
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth === reportedWidth) {
      return;
    }
    reportedWidth = window.innerWidth;
    post("viewport", { viewportWidth: reportedWidth });
    if (highlightSelector !== null) {
      reportHighlight();
    }
  });

  window.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (isSelecting) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var marked = target.closest("[data-nef-line]");
        var payload = routePayload();
        var parts = partChain(target);
        var box = target.getBoundingClientRect();
        payload.line = marked ? Number(marked.dataset.nefLine) : null;
        payload.tag = target.localName;
        payload.parts = parts;
        payload.inContent = target.closest("[data-part='content']") !== null;
        payload.selectors = suggestedSelectors(target, parts);
        payload.viewportWidth = window.innerWidth;
        payload.rect = { x: box.x, y: box.y, width: box.width, height: box.height };
        payload.styles = computedStyles(target);
        post("selected", payload);
        return;
      }
      if (target.id === "send-foreign") {
        sendForeignMessages();
        return;
      }
      var link = target.closest("a[data-client-nav]");
      if (link) {
        event.preventDefault();
        window.history.pushState({}, "", link.getAttribute("href"));
        render(currentRoute());
        post("route", routePayload());
      }
    },
    true
  );

  window.addEventListener(
    "keydown",
    function (event) {
      if (isSelecting && event.key === "Escape") {
        setSelecting(false);
      }
    },
    true
  );

  var ready = routePayload();
  ready.viewportWidth = window.innerWidth;
  post("ready", ready);
  pollState();
})();
`;

export async function createFakeCore(): Promise<string> {
  const dir = await createTempDir("nefantaris-fakecore-");
  await mkdir(path.join(dir, "dist", "cli"), { recursive: true });
  await writeFile(path.join(dir, "dist", "cli", "index.js"), fakeCoreCliSource);
  await writeFile(
    path.join(dir, "dist", "cli", "fakeBridge.js"),
    fakeBridgeSource,
  );
  return dir;
}

export async function setFakeCoreMode(
  sitePath: string,
  mode: FakeCoreMode,
): Promise<void> {
  await writeFile(path.join(sitePath, ".fake-core-mode"), mode);
}

export async function openSiteWithFakeCore(
  sitePath: string,
  extraEnv: Record<string, string> = {},
): Promise<{ app: ElectronApplication; window: Page }> {
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, {
    NEFANTARIS_CORE_DIR: fakeCoreDir,
    ...extraEnv,
  });
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  return { app, window: await siteWindowPromise };
}
