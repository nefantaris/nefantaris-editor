import type { ReactNode } from "react";
import { classNames } from "../../utils/classNames.ts";

export type ToolbarShortcut = { aria: string; text: string };

type ToolbarButtonProps = {
  label: string;
  icon: ReactNode;
  shortcut?: ToolbarShortcut;
  isPressed?: boolean;
  isDisabled: boolean;
  isTabStop: boolean;
  onFocused: () => void;
  onClicked: () => void;
};

export const toolbarControlClasses =
  "text-ink-secondary hover:bg-raised hover:text-ink aria-pressed:bg-raised aria-pressed:text-ink aria-disabled:text-ink-disabled aria-disabled:hover:bg-transparent aria-disabled:cursor-default rounded-md transition-colors duration-100";

export const tooltipClasses =
  "bg-tooltip text-on-tooltip pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden -translate-x-1/2 rounded-md px-2 py-1 text-xs font-normal group-hover:block group-has-[:focus-visible]:block";

const ToolbarButton = ({
  label,
  icon,
  shortcut,
  isPressed,
  isDisabled,
  isTabStop,
  onFocused,
  onClicked,
}: ToolbarButtonProps) => {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        data-toolbar-item
        aria-label={label}
        aria-pressed={isPressed}
        aria-disabled={isDisabled || undefined}
        aria-keyshortcuts={shortcut?.aria}
        tabIndex={isTabStop ? 0 : -1}
        onFocus={onFocused}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!isDisabled) {
            onClicked();
          }
        }}
        className={classNames(toolbarControlClasses, "p-1.5")}
      >
        {icon}
      </button>
      <span
        aria-hidden="true"
        className={classNames(tooltipClasses, "whitespace-nowrap")}
      >
        {label}
        {shortcut !== undefined && (
          <kbd className="border-on-tooltip/30 ml-2 rounded-md border px-1 font-sans">
            {shortcut.text}
          </kbd>
        )}
      </span>
    </span>
  );
};

export default ToolbarButton;
