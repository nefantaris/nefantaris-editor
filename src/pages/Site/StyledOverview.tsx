import { useId } from "react";
import type {
  StyledRule,
  StyleScope,
  ThemePart,
} from "../../../electron/ipcContract.cts";
import { classNames } from "../../utils/classNames.ts";
import { scopeLabels, styleScopes } from "./styleBreakpoints.ts";
import {
  describeSelector,
  targetFor,
  type StyleTarget,
} from "./styleTargets.ts";

type StyledOverviewProps = {
  rules: StyledRule[];
  parts: Record<string, ThemePart>;
  current: { selector: string; scope: StyleScope } | null;
  onJump: (target: StyleTarget, scope: StyleScope) => void;
};

type StyledGroup = {
  target: StyleTarget;
  isOwnSelector: boolean;
  counts: Map<StyleScope, number>;
};

function groupsFrom(
  rules: StyledRule[],
  parts: Record<string, ThemePart>,
): StyledGroup[] {
  const groups = new Map<string, StyledGroup>();
  for (const rule of rules) {
    if (rule.declarations.length === 0) {
      continue;
    }
    const group = groups.get(rule.key) ?? {
      target: targetFor(rule.key, parts),
      isOwnSelector: describeSelector(rule.key, parts) === null,
      counts: new Map<StyleScope, number>(),
    };
    group.counts.set(
      rule.scope,
      (group.counts.get(rule.scope) ?? 0) + rule.declarations.length,
    );
    groups.set(rule.key, group);
  }
  return [...groups.values()];
}

function changeCountText(count: number): string {
  return count === 1 ? "1 change" : `${String(count)} changes`;
}

const StyledOverview = ({
  rules,
  parts,
  current,
  onJump,
}: StyledOverviewProps) => {
  const headingId = useId();
  const groups = groupsFrom(rules, parts);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-ink text-base font-medium">
        Styled on this site
      </h2>
      {groups.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Nothing yet. Pick something to style, and it shows up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map(({ target, isOwnSelector, counts }) => (
            <li
              key={target.selector}
              aria-label={target.label}
              className="border-line flex flex-col gap-1.5 rounded-md border p-2"
            >
              <span className="text-ink text-sm">{target.label}</span>
              {isOwnSelector && (
                <code className="text-ink-secondary font-mono text-xs break-all">
                  {target.selector}
                </code>
              )}
              <div className="flex flex-wrap gap-1">
                {styleScopes.flatMap((scope) => {
                  const count = counts.get(scope);
                  if (count === undefined) {
                    return [];
                  }
                  const isCurrent =
                    current?.selector === target.selector &&
                    current.scope === scope;
                  return [
                    <button
                      key={scope}
                      type="button"
                      aria-current={isCurrent || undefined}
                      aria-label={`${target.label}, ${scopeLabels[scope]}: ${changeCountText(count)}`}
                      onClick={() => onJump(target, scope)}
                      className={classNames(
                        "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-100",
                        isCurrent
                          ? "bg-primary text-on-primary"
                          : "bg-raised text-ink-secondary hover:bg-raised-strong",
                      )}
                    >
                      {`${scopeLabels[scope]} · ${String(count)}`}
                    </button>,
                  ];
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default StyledOverview;
