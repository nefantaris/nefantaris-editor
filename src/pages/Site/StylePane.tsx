import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type {
  PreviewProblem,
  SiteInspection,
  StyledRule,
  StyleEdit,
  StyleEditResult,
  StyleRulesState,
  StyleScope,
  ThemePart,
  ThemeStyleToken,
} from "../../../electron/ipcContract.cts";
import { PanelRightIcon } from "../../components/Icons.tsx";
import ModalDialog from "../../components/ModalDialog.tsx";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import type { BridgeStyles } from "./previewBridge.ts";
import type { BridgeEvent, PreviewBridgeHub } from "./previewBridgeHub.ts";
import PreviewProblemNotice from "./PreviewProblemNotice.tsx";
import {
  iconButtonClasses,
  modalDangerButtonClasses,
  modalSecondaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";
import {
  scopeLabels,
  widerScopes,
  type StyleBreakpointPlan,
} from "./styleBreakpoints.ts";
import StyleBreakpointSwitch from "./StyleBreakpointSwitch.tsx";
import {
  contrastBetween,
  flattenedBackground,
  parsedColor,
  resolvedValue,
  semanticSwatches,
  tokenValuesFor,
  type ContrastCheck,
} from "./styleColors.ts";
import StyledOverview from "./StyledOverview.tsx";
import { propertyLabel } from "./styleProperties.ts";
import StylePropertyGroups from "./StylePropertyGroups.tsx";
import StyleTargetChooser, {
  type PickChoice,
  type TargetMatch,
} from "./StyleTargetChooser.tsx";
import {
  elementTypeTargets,
  partSelector,
  partTargets,
  targetFor,
  type StyleSelection,
  type StyleTarget,
} from "./styleTargets.ts";
import { partsInSelector, themeFontsFrom } from "./styleTheme.ts";
import {
  declaredIn,
  rulesWithEdit,
  type StyleFieldStatus,
} from "./styleValues.ts";

type StylePaneProps = {
  sitePath: string;
  inspection: SiteInspection | null;
  hub: PreviewBridgeHub;
  plan: StyleBreakpointPlan;
  scope: StyleScope;
  selection: StyleSelection | null;
  isPreviewOpen: boolean;
  isCollapsed: boolean;
  hasCssDraft: boolean;
  cssDraftRef: RefObject<string | null>;
  previewProblem: PreviewProblem | null;
  onScopeChanged: (scope: StyleScope) => void;
  onSelectionChanged: (selection: StyleSelection) => void;
  onCollapsedChanged: (isCollapsed: boolean) => void;
  onPreviewRequested: () => void;
  onCssRequested: () => void;
  onSavingChanged: (isSaving: boolean) => void;
};

type InspectedEntry = TargetMatch & {
  styles: BridgeStyles | null;
};

type ResetTargetModalProps = {
  label: string;
  onConfirm: () => void;
  onClose: () => void;
};

const PAGE_SELECTORS = ["body", "html"];
const FIRST_REFRESH_MS = 200;
const SECOND_REFRESH_MS = 900;
const noParts: Record<string, ThemePart> = {};

const ResetTargetModal = ({
  label,
  onConfirm,
  onClose,
}: ResetTargetModalProps) => (
  <ModalDialog title="Reset all styles for this target?" onClose={onClose}>
    <p className="text-ink-secondary text-sm">
      Everything set for &ldquo;{label}&rdquo; goes, at every screen size, and
      your theme&rsquo;s look comes back.
    </p>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onConfirm}
        className={modalDangerButtonClasses}
      >
        Reset all
      </button>
      <button
        type="button"
        onClick={onClose}
        className={modalSecondaryButtonClasses}
      >
        Cancel
      </button>
    </div>
  </ModalDialog>
);

const leadingNumberPattern = /^-?(?:\d+\.?\d*|\.\d+)/;

function numberOf(value: string | undefined): number {
  return Number(leadingNumberPattern.exec(value ?? "")?.[0] ?? 0);
}

const StylePane = ({
  sitePath,
  inspection,
  hub,
  plan,
  scope,
  selection,
  isPreviewOpen,
  isCollapsed,
  hasCssDraft,
  cssDraftRef,
  previewProblem,
  onScopeChanged,
  onSelectionChanged,
  onCollapsedChanged,
  onPreviewRequested,
  onCssRequested,
  onSavingChanged,
}: StylePaneProps) => {
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const bridgeState = useSyncExternalStore(hub.subscribeState, hub.getState);
  const [rulesState, setRulesState] = useState<StyleRulesState | null>(null);
  const [tokens, setTokens] = useState<ThemeStyleToken[]>([]);
  const [inspected, setInspected] = useState<Record<string, InspectedEntry>>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const target = selection?.target ?? null;
  const pickSelectors = selection?.choices ?? null;
  const pickParts = selection?.chain ?? null;
  const parts = inspection?.parts ?? noParts;
  const elementTypes = elementTypeTargets(parts);
  const partList = partTargets(parts);
  const rules: StyledRule[] =
    rulesState?.status === "ok" ? rulesState.rules : [];
  const declared =
    target === null
      ? new Map<string, string>()
      : declaredIn(rules, target.selector, scope);
  const isPicking = bridgeState.isConnected && bridgeState.isSelecting;
  const targetEntry = target === null ? undefined : inspected[target.selector];
  const computed = targetEntry?.styles ?? null;
  const contextParts = (
    pickParts ?? (target === null ? [] : partsInSelector(target.selector))
  ).toReversed();
  const tokenMap = tokenValuesFor(tokens, inspection);
  const swatches = semanticSwatches(tokenMap);
  const themeFonts = themeFontsFrom(tokens, inspection);
  const hasTargetRules =
    target !== null && rules.some((rule) => rule.key === target.selector);
  const overridden = [...declared.keys()].map(propertyLabel);
  const pickChoices: PickChoice[] | null =
    pickSelectors?.map((selector) => ({
      ...targetFor(selector, parts),
      count: inspected[selector]?.count ?? null,
    })) ?? null;
  const match: TargetMatch | null =
    targetEntry === undefined
      ? null
      : { count: targetEntry.count, visible: targetEntry.visible };
  const isUnparseable = rulesState?.status === "unparseable";

  const resolvedColorOf = (property: string, fallback: string) => {
    const value = declared.get(property);
    const resolved =
      value === undefined ? null : resolvedValue(value, tokenMap);
    return parsedColor(resolved ?? fallback);
  };

  const contrastNow = (): ContrastCheck | null => {
    if (computed === null) {
      return null;
    }
    const text = resolvedColorOf("color", computed.color ?? "");
    if (text === null) {
      return null;
    }
    const layers = [
      resolvedColorOf("background-color", computed["background-color"] ?? ""),
      ...[...contextParts.map(partSelector), ...PAGE_SELECTORS].map(
        (selector) =>
          parsedColor(inspected[selector]?.styles?.["background-color"] ?? ""),
      ),
    ];
    return contrastBetween(
      text,
      flattenedBackground(layers),
      numberOf(computed["font-size"]),
      numberOf(computed["font-weight"]),
    );
  };

  const statusOf = (property: string): StyleFieldStatus => {
    const wider =
      target === null
        ? undefined
        : widerScopes(scope).find((candidate) =>
            declaredIn(rules, target.selector, candidate).has(property),
          );
    return {
      isSet: declared.has(property),
      inheritedFrom: wider === undefined ? null : scopeLabels[wider],
    };
  };

  const inspectSelectors = (selectors: string[]) => {
    for (const selector of new Set(selectors)) {
      hub.send("inspect-selector", { selector });
    }
  };

  const refreshPreview = () => {
    inspectSelectors([
      ...(target === null ? [] : [target.selector]),
      ...(pickSelectors ?? []),
      ...contextParts.map(partSelector),
      ...PAGE_SELECTORS,
    ]);
  };

  const secondRefresh = useDebouncedCallback(refreshPreview, SECOND_REFRESH_MS);
  const firstRefresh = useDebouncedCallback(() => {
    refreshPreview();
    secondRefresh.schedule();
  }, FIRST_REFRESH_MS);

  const chooseTarget = (
    next: StyleTarget,
    choices: string[] | null,
    chain: string[] | null,
  ) => {
    onSelectionChanged({ target: next, choices, chain });
    setNotice(null);
    hub.send("highlight", { selector: next.selector });
    inspectSelectors([
      next.selector,
      ...(choices ?? []),
      ...(chain ?? partsInSelector(next.selector)).map(partSelector),
      ...PAGE_SELECTORS,
    ]);
  };

  const changePicking = (isActive: boolean) => {
    hub.publish({ type: "select-mode", active: isActive });
    hub.send("select-mode", { active: isActive });
  };

  const handlePick = (event: Extract<BridgeEvent, { type: "selected" }>) => {
    const suggestions =
      event.selectors.length > 0 ? event.selectors : [event.tag];
    changePicking(false);
    chooseTarget(targetFor(suggestions[0], parts), suggestions, event.parts);
  };

  const loadRules = async () => {
    setRulesState(
      await globalThis.nefantaris.invoke(
        "styleRules:read",
        sitePath,
        plan.widths,
      ),
    );
  };

  const finishWrite = (result: StyleEditResult) => {
    const isLast = pendingWritesRef.current === 1;
    if (result.status === "saved" && isLast) {
      setRulesState({ status: "ok", rules: result.rules });
    } else if (result.status === "unparseable") {
      setRulesState(result);
    } else if (result.status === "rejected") {
      setNotice("That value can’t be used here, so it wasn’t saved.");
      void loadRules();
    }
  };

  const runWrite = (
    optimistic: (current: StyledRule[]) => StyledRule[],
    operation: () => Promise<StyleEditResult>,
  ) => {
    if (cssDraftRef.current !== null || rulesState?.status !== "ok") {
      setNotice("Finish the edit in CSS first.");
      return;
    }
    setNotice(null);
    setRulesState({ status: "ok", rules: optimistic(rulesState.rules) });
    pendingWritesRef.current += 1;
    onSavingChanged(true);
    const previous = writeQueueRef.current;
    writeQueueRef.current = (async () => {
      await previous;
      try {
        finishWrite(await operation());
      } finally {
        pendingWritesRef.current -= 1;
        onSavingChanged(pendingWritesRef.current > 0);
      }
      firstRefresh.schedule();
    })();
  };

  const changeProperty = (property: string, value: string | null) => {
    if (target === null) {
      return;
    }
    const edit: StyleEdit = {
      selector: target.selector,
      scope,
      set: value === null ? [] : [{ property, value }],
      remove: value === null ? [property] : [],
    };
    runWrite(
      (current) => rulesWithEdit(current, edit),
      () =>
        globalThis.nefantaris.invoke(
          "styleRules:edit",
          sitePath,
          plan.widths,
          edit,
        ),
    );
  };

  const resetTarget = () => {
    setIsResetOpen(false);
    if (target === null) {
      return;
    }
    const selector = target.selector;
    runWrite(
      (current) => current.filter((rule) => rule.key !== selector),
      () =>
        globalThis.nefantaris.invoke(
          "styleRules:resetTarget",
          sitePath,
          plan.widths,
          selector,
        ),
    );
  };

  const jumpTo = (next: StyleTarget, nextScope: StyleScope) => {
    chooseTarget(next, null, null);
    onScopeChanged(nextScope);
  };

  useEffect(() => {
    const loadStyles = async () => {
      await loadRules();
      setTokens(
        await globalThis.nefantaris.invoke("styleRules:themeTokens", sitePath),
      );
    };
    void loadStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePath, plan.widths.tablet, plan.widths.phone]);

  useEffect(() => {
    return globalThis.nefantaris.on("customCss:changed", (payload) => {
      if (payload.sitePath === sitePath && pendingWritesRef.current === 0) {
        void loadRules();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePath, plan.widths.tablet, plan.widths.phone]);

  useEffect(() => {
    return hub.listen((event) => {
      switch (event.type) {
        case "inspected": {
          setInspected((current) => ({
            ...current,
            [event.selector]: {
              count: event.count,
              visible: event.visible,
              styles: event.styles,
            },
          }));
          return;
        }
        case "selected": {
          handlePick(event);
          return;
        }
        case "ready": {
          if (target !== null) {
            hub.send("highlight", { selector: target.selector });
          }
          refreshPreview();
          return;
        }
        case "route":
        case "viewport": {
          refreshPreview();
          return;
        }
        default: {
          return;
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, target, pickSelectors, pickParts, parts]);

  useEffect(() => {
    if (target !== null) {
      hub.send("highlight", { selector: target.selector });
    }
    refreshPreview();
    return () => {
      hub.send("highlight", { selector: null });
      if (hub.getState().isSelecting) {
        hub.publish({ type: "select-mode", active: false });
        hub.send("select-mode", { active: false });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub]);

  return isCollapsed ? (
    <div className="border-line bg-sunken flex h-full flex-col items-center border-r py-2">
      <button
        type="button"
        aria-label="Show the style panel"
        title="Show the style panel"
        onClick={() => onCollapsedChanged(false)}
        className={iconButtonClasses}
      >
        <PanelRightIcon />
      </button>
    </div>
  ) : (
    <div className="border-line h-full overflow-y-auto border-r">
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-ink text-xl font-semibold">Style</h1>
            <p className="text-ink-muted text-sm">
              Change how parts of your site look. Your changes go in your CSS,
              after your theme&rsquo;s styles, so they win.
            </p>
          </div>
          <button
            type="button"
            aria-label="Hide the style panel"
            title="Hide the style panel"
            onClick={() => onCollapsedChanged(true)}
            className={iconButtonClasses}
          >
            <PanelRightIcon />
          </button>
        </div>
        {previewProblem !== null && (
          <PreviewProblemNotice problem={previewProblem} />
        )}
        {!isPreviewOpen && (
          <div className="flex flex-col items-start gap-2">
            <p role="status" className="text-ink-secondary text-sm">
              The preview is closed. Open it to pick things on the page and see
              your changes as you make them.
            </p>
            <button
              type="button"
              onClick={onPreviewRequested}
              className={secondaryButtonClasses}
            >
              Open the preview
            </button>
          </div>
        )}
        {(hasCssDraft || isUnparseable) && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-danger text-sm">
              {hasCssDraft
                ? "Your CSS has an edit that isn’t finished, so the Style panel can’t change it safely. Finish the edit in CSS first."
                : `Your CSS has a mistake${
                    rulesState?.status === "unparseable" &&
                    rulesState.line !== null
                      ? ` on line ${String(rulesState.line)}`
                      : ""
                  }, so the Style panel can’t change it safely. Finish the edit in CSS first.`}
            </p>
            <button
              type="button"
              onClick={onCssRequested}
              className={secondaryButtonClasses}
            >
              Open CSS
            </button>
          </div>
        )}
        {notice !== null && !hasCssDraft && (
          <p role="alert" className="text-danger text-sm">
            {notice}
          </p>
        )}
        <StyleTargetChooser
          target={target}
          pickChoices={pickChoices}
          elementTypes={elementTypes}
          partTargets={partList}
          isPicking={isPicking}
          canPick={bridgeState.isConnected}
          match={match}
          onPickToggled={() => changePicking(!isPicking)}
          onTargetChosen={(next) =>
            chooseTarget(
              next,
              pickSelectors?.includes(next.selector) === true
                ? pickSelectors
                : null,
              pickSelectors?.includes(next.selector) === true
                ? pickParts
                : null,
            )
          }
        />
        <StyleBreakpointSwitch
          scope={scope}
          plan={plan}
          overridden={target === null ? [] : overridden}
          onScopeChanged={onScopeChanged}
        />
        {target !== null && !isUnparseable && (
          <section aria-label="Properties" className="flex flex-col gap-3">
            <StylePropertyGroups
              key={`${target.selector}|${scope}`}
              declared={declared}
              computed={computed}
              statusOf={statusOf}
              swatches={swatches}
              themeFonts={themeFonts}
              contrast={contrastNow()}
              onChange={changeProperty}
            />
            {hasTargetRules && (
              <button
                type="button"
                onClick={() => setIsResetOpen(true)}
                className={secondaryButtonClasses}
              >
                Reset all styles for this target
              </button>
            )}
          </section>
        )}
        {!isUnparseable && (
          <StyledOverview
            rules={rules}
            parts={parts}
            current={
              target === null ? null : { selector: target.selector, scope }
            }
            onJump={jumpTo}
          />
        )}
      </div>
      {isResetOpen && target !== null && (
        <ResetTargetModal
          label={target.label}
          onConfirm={resetTarget}
          onClose={() => setIsResetOpen(false)}
        />
      )}
    </div>
  );
};

export default StylePane;
