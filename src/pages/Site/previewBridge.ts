const BRIDGE_PROTOCOL = 1;

export type BridgeStyles = Record<string, string>;

export type BridgeMatchSummary = {
  count: number;
  valid: boolean;
  visible: number;
};

export type BridgeSelection = {
  tag: string;
  parts: string[];
  inContent: boolean;
  selectors: string[];
  styles: BridgeStyles | null;
};

export type BridgeErrorReport = {
  kind: "build" | "runtime";
  message: string;
  file: string | null;
  line: number | null;
};

export type BridgeMessage =
  | {
      type: "ready";
      route: string;
      file: string | null;
      viewportWidth: number | null;
    }
  | { type: "route"; route: string; file: string | null }
  | { type: "select-mode"; active: boolean }
  | ({
      type: "selected";
      route: string;
      file: string | null;
      line: number | null;
    } & BridgeSelection)
  | ({ type: "highlighted"; selector: string | null } & BridgeMatchSummary)
  | ({
      type: "inspected";
      selector: string;
      styles: BridgeStyles | null;
      viewportWidth: number | null;
    } & BridgeMatchSummary)
  | { type: "viewport"; viewportWidth: number }
  | ({ type: "error" } & BridgeErrorReport)
  | { type: "error-cleared" };

export type OutgoingBridgeType =
  "ping" | "select-mode" | "highlight" | "inspect-selector";

const MESSAGE_PREFIX = "nefantaris:";
const contentFilePattern =
  /^content\/(?:pages|posts)\/(?:[^/\\]+\/)*[^/\\]+\.md$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function contentFileOf(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "string" &&
    contentFilePattern.test(value) &&
    !value.split("/").includes("..")
    ? value
    : undefined;
}

function siteFileOf(value: unknown): string | null {
  return typeof value === "string" &&
    value !== "" &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").includes("..")
    ? value
    : null;
}

function lineOf(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : undefined;
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function widthOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stylesOf(value: unknown): BridgeStyles | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function matchSummaryOf(data: Record<string, unknown>): BridgeMatchSummary {
  return {
    count: countOf(data.count),
    valid: data.valid !== false,
    visible: countOf(data.visible),
  };
}

function selectionOf(data: Record<string, unknown>): BridgeSelection {
  return {
    tag: typeof data.tag === "string" ? data.tag : "",
    parts: stringsOf(data.parts),
    inContent: data.inContent === true,
    selectors: stringsOf(data.selectors),
    styles: stylesOf(data.styles),
  };
}

function errorReportOf(data: Record<string, unknown>): BridgeErrorReport {
  const file = siteFileOf(data.file);
  return {
    kind: data.kind === "build" ? "build" : "runtime",
    message: typeof data.message === "string" ? data.message : "",
    file,
    line: file === null ? null : (lineOf(data.line) ?? null),
  };
}

function selectorMessageOf(
  type: string,
  data: Record<string, unknown>,
): BridgeMessage | null {
  if (type === "highlighted") {
    const selector = typeof data.selector === "string" ? data.selector : null;
    return { type, selector, ...matchSummaryOf(data) };
  }
  if (type === "inspected" && typeof data.selector === "string") {
    return {
      type,
      selector: data.selector,
      styles: stylesOf(data.styles),
      viewportWidth: widthOf(data.viewportWidth),
      ...matchSummaryOf(data),
    };
  }
  return null;
}

function routedMessageOf(
  type: string,
  data: Record<string, unknown>,
): BridgeMessage | null {
  const route = typeof data.route === "string" ? data.route : null;
  const file = contentFileOf(data.file);
  if (route === null || file === undefined) {
    return null;
  }
  if (type === "ready") {
    return { type, route, file, viewportWidth: widthOf(data.viewportWidth) };
  }
  if (type === "route") {
    return { type, route, file };
  }
  if (type === "selected") {
    const line = lineOf(data.line);
    return line === undefined
      ? null
      : { type, route, file, line, ...selectionOf(data) };
  }
  return null;
}

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (
    !isRecord(data) ||
    data.protocol !== BRIDGE_PROTOCOL ||
    typeof data.type !== "string" ||
    !data.type.startsWith(MESSAGE_PREFIX)
  ) {
    return null;
  }
  const type = data.type.slice(MESSAGE_PREFIX.length);
  switch (type) {
    case "select-mode": {
      return typeof data.active === "boolean"
        ? { type, active: data.active }
        : null;
    }
    case "viewport": {
      const viewportWidth = widthOf(data.viewportWidth);
      return viewportWidth === null ? null : { type, viewportWidth };
    }
    case "error": {
      return { type, ...errorReportOf(data) };
    }
    case "error-cleared": {
      return { type };
    }
    case "highlighted":
    case "inspected": {
      return selectorMessageOf(type, data);
    }
    default: {
      return routedMessageOf(type, data);
    }
  }
}

export function bridgeMessage(
  type: OutgoingBridgeType,
  payload: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: `${MESSAGE_PREFIX}${type}`,
    protocol: BRIDGE_PROTOCOL,
    ...payload,
  };
}
