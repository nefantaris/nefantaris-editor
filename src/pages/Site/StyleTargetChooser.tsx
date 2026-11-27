import { useId } from "react";
import { PointerIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import { secondaryButtonClasses } from "./settingsStyles.ts";
import type { StyleTarget } from "./styleTargets.ts";

export type PickChoice = StyleTarget & {
  count: number | null;
};

export type TargetMatch = {
  count: number;
  visible: number;
};

type StyleTargetChooserProps = {
  target: StyleTarget | null;
  pickChoices: PickChoice[] | null;
  elementTypes: StyleTarget[];
  partTargets: StyleTarget[];
  isPicking: boolean;
  canPick: boolean;
  match: TargetMatch | null;
  onPickToggled: () => void;
  onTargetChosen: (target: StyleTarget) => void;
};

const selectClasses =
  "bg-field text-ink border-transparent focus:ring-primary disabled:text-ink-disabled w-full rounded-md border px-2 py-1.5 text-sm focus:ring-2 focus:outline-none";

function matchText(match: TargetMatch): string {
  if (match.count === 0) {
    return "Nothing on this page matches.";
  }
  const shown = `${String(match.count)} on this page`;
  const hidden = match.count - match.visible;
  return hidden > 0
    ? `${shown}, ${String(hidden)} hidden at this size.`
    : `${shown}.`;
}

function countText(count: number | null): string {
  return count === null ? "" : ` (${String(count)})`;
}

const StyleTargetChooser = ({
  target,
  pickChoices,
  elementTypes,
  partTargets,
  isPicking,
  canPick,
  match,
  onPickToggled,
  onTargetChosen,
}: StyleTargetChooserProps) => {
  const baseId = useId();
  const typeId = `${baseId}-type`;
  const partId = `${baseId}-part`;
  const choicesId = `${baseId}-choices`;
  const typeValue =
    elementTypes.find((entry) => entry.selector === target?.selector)
      ?.selector ?? "";
  const partValue =
    partTargets.find((entry) => entry.selector === target?.selector)
      ?.selector ?? "";

  const chooseFrom = (targets: StyleTarget[], selector: string) => {
    const chosen = targets.find((entry) => entry.selector === selector);
    if (chosen !== undefined) {
      onTargetChosen(chosen);
    }
  };

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="flex flex-col gap-3"
    >
      <h2 id={`${baseId}-heading`} className="text-ink text-base font-medium">
        What to style
      </h2>
      <button
        type="button"
        aria-pressed={isPicking}
        disabled={!canPick}
        onClick={onPickToggled}
        className={classNames(
          secondaryButtonClasses,
          "justify-center",
          isPicking && "bg-primary text-on-primary hover:bg-primary-hover",
        )}
      >
        <PointerIcon />
        Pick on the page
      </button>
      {isPicking && (
        <p aria-live="polite" className="text-ink-secondary text-xs">
          Click something in the preview. Esc stops.
        </p>
      )}
      {pickChoices !== null && pickChoices.length > 0 && (
        <div
          role="radiogroup"
          aria-labelledby={choicesId}
          className="flex flex-col gap-1"
        >
          <span
            id={choicesId}
            className="text-ink-secondary text-xs font-medium"
          >
            Style which?
          </span>
          {pickChoices.map((choice) => (
            <label
              key={choice.selector}
              className={classNames(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors duration-100",
                choice.selector === target?.selector
                  ? "border-primary"
                  : "border-line hover:bg-sunken",
              )}
            >
              <input
                type="radio"
                name={choicesId}
                checked={choice.selector === target?.selector}
                onChange={() => onTargetChosen(choice)}
                className="accent-primary h-4 w-4 shrink-0"
              />
              <span className="text-ink">
                {`${choice.label}${countText(choice.count)}`}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={typeId}
            className="text-ink-secondary text-xs font-medium"
          >
            Element type
          </label>
          <select
            id={typeId}
            value={typeValue}
            onChange={(event) => chooseFrom(elementTypes, event.target.value)}
            className={selectClasses}
          >
            <option value="" disabled>
              Choose…
            </option>
            {elementTypes.map((entry) => (
              <option key={entry.selector} value={entry.selector}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={partId}
            className="text-ink-secondary text-xs font-medium"
          >
            Theme part
          </label>
          <select
            id={partId}
            value={partValue}
            disabled={partTargets.length === 0}
            onChange={(event) => chooseFrom(partTargets, event.target.value)}
            className={selectClasses}
          >
            <option value="" disabled>
              {partTargets.length === 0 ? "None named" : "Choose…"}
            </option>
            {partTargets.map((entry) => (
              <option key={entry.selector} value={entry.selector}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {target !== null && (
        <div className="bg-sunken flex flex-col gap-1 rounded-md p-3">
          <span className="text-ink text-sm font-medium">{target.label}</span>
          {match !== null && (
            <span className="text-ink-secondary text-xs">
              {matchText(match)}
            </span>
          )}
          <details className="text-xs">
            <summary className="text-ink-secondary cursor-pointer">CSS</summary>
            <code className="bg-surface text-ink-secondary mt-1 block rounded-md p-2 font-mono break-all">
              {target.selector}
            </code>
          </details>
        </div>
      )}
    </section>
  );
};

export default StyleTargetChooser;
