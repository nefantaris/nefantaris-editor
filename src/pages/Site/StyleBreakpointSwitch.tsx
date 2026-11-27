import { useId } from "react";
import type { StyleScope } from "../../../electron/ipcContract.cts";
import { classNames } from "../../utils/classNames.ts";
import {
  scopeDescription,
  scopeLabels,
  styleScopes,
  type StyleBreakpointPlan,
} from "./styleBreakpoints.ts";

type StyleBreakpointSwitchProps = {
  scope: StyleScope;
  plan: StyleBreakpointPlan;
  overridden: string[];
  onScopeChanged: (scope: StyleScope) => void;
};

const reachText: Record<StyleScope, string> = {
  all: "",
  tablet:
    "What you change here applies to tablets and phones, unless Phone says otherwise.",
  phone: "What you change here applies only to phones.",
};

function overriddenText(scope: StyleScope, overridden: string[]): string {
  if (overridden.length === 0) {
    return `Nothing is overridden on ${scopeLabels[scope]} yet. ${reachText[scope]}`;
  }
  return `Overridden on ${scopeLabels[scope]}: ${overridden.join(", ")}.`;
}

const StyleBreakpointSwitch = ({
  scope,
  plan,
  overridden,
  onScopeChanged,
}: StyleBreakpointSwitchProps) => {
  const baseId = useId();
  const headingId = `${baseId}-heading`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-ink text-base font-medium">
        Screen size
      </h2>
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        className="border-line flex overflow-hidden rounded-md border"
      >
        {styleScopes.map((option) => (
          <label
            key={option}
            className={classNames(
              "has-focus-visible:ring-primary grow cursor-pointer px-2 py-1.5 text-center text-sm font-medium transition-colors duration-100 has-focus-visible:ring-2 has-focus-visible:ring-inset",
              option === scope
                ? "bg-primary text-on-primary"
                : "text-ink-secondary hover:bg-raised",
            )}
          >
            <input
              type="radio"
              name={baseId}
              value={option}
              checked={option === scope}
              onChange={() => onScopeChanged(option)}
              className="sr-only"
            />
            {scopeLabels[option]}
          </label>
        ))}
      </div>
      <p className="text-ink-muted text-xs">{scopeDescription(scope, plan)}</p>
      {scope !== "all" && (
        <p className="text-ink-secondary text-xs">
          {overriddenText(scope, overridden)}
        </p>
      )}
    </section>
  );
};

export default StyleBreakpointSwitch;
