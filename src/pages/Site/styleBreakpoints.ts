import type {
  StyleMediaWidths,
  StyleScope,
  ThemeBreakpoint,
} from "../../../electron/ipcContract.cts";
import type { PreviewFrame } from "./PreviewPane.tsx";

export type StyleBreakpointPlan = {
  widths: StyleMediaWidths;
  tabletBelow: number;
  phoneBelow: number;
  frames: Record<StyleScope, PreviewFrame>;
};

export const styleScopes: StyleScope[] = ["all", "tablet", "phone"];

export const scopeLabels: Record<StyleScope, string> = {
  all: "All sizes",
  tablet: "Tablet",
  phone: "Phone",
};

const TABLET_BREAKPOINT_NAME = "lg";
const PHONE_BREAKPOINT_NAME = "md";
const TYPICAL_TABLET_BELOW = 1024;
const TYPICAL_PHONE_BELOW = 768;
const PHONE_FRAME_WIDTH = 375;

const tailwindPair: [ThemeBreakpoint, ThemeBreakpoint] = [
  { name: TABLET_BREAKPOINT_NAME, minWidth: TYPICAL_TABLET_BELOW },
  { name: PHONE_BREAKPOINT_NAME, minWidth: TYPICAL_PHONE_BELOW },
];

function nearestTo(
  breakpoints: ThemeBreakpoint[],
  width: number,
): ThemeBreakpoint | undefined {
  return breakpoints.toSorted(
    (first, second) =>
      Math.abs(first.minWidth - width) - Math.abs(second.minWidth - width),
  )[0];
}

function pairFrom(
  breakpoints: ThemeBreakpoint[],
): [ThemeBreakpoint, ThemeBreakpoint] | null {
  const tablet =
    breakpoints.find((entry) => entry.name === TABLET_BREAKPOINT_NAME) ??
    nearestTo(breakpoints, TYPICAL_TABLET_BELOW);
  if (tablet === undefined) {
    return null;
  }
  const narrower = breakpoints.filter(
    (entry) => entry.minWidth < tablet.minWidth,
  );
  const phone =
    narrower.find((entry) => entry.name === PHONE_BREAKPOINT_NAME) ??
    nearestTo(narrower, TYPICAL_PHONE_BELOW);
  return phone === undefined ? null : [tablet, phone];
}

function maxWidthBelow(minWidth: number): number {
  return (Math.round(minWidth * 100) - 2) / 100;
}

export function breakpointPlanFor(
  breakpoints: ThemeBreakpoint[] | null,
): StyleBreakpointPlan {
  const [tablet, phone] = pairFrom(breakpoints ?? []) ?? tailwindPair;
  return {
    widths: {
      tablet: maxWidthBelow(tablet.minWidth),
      phone: maxWidthBelow(phone.minWidth),
    },
    tabletBelow: tablet.minWidth,
    phoneBelow: phone.minWidth,
    frames: {
      all: { label: scopeLabels.all, width: tablet.minWidth, isExact: false },
      tablet: {
        label: scopeLabels.tablet,
        width: Math.round(phone.minWidth),
        isExact: true,
      },
      phone: {
        label: scopeLabels.phone,
        width: Math.min(PHONE_FRAME_WIDTH, Math.ceil(phone.minWidth) - 1),
        isExact: true,
      },
    },
  };
}

export function scopeDescription(
  scope: StyleScope,
  plan: StyleBreakpointPlan,
): string {
  switch (scope) {
    case "all": {
      return "Every screen, unless Tablet or Phone says otherwise";
    }
    case "tablet": {
      return `Screens narrower than ${String(plan.tabletBelow)} px`;
    }
    case "phone": {
      return `Screens narrower than ${String(plan.phoneBelow)} px`;
    }
  }
}

export function widerScopes(scope: StyleScope): StyleScope[] {
  return styleScopes.slice(0, styleScopes.indexOf(scope)).toReversed();
}
