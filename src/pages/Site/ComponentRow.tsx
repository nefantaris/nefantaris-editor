import StatusDot from "../../components/StatusDot.tsx";
import type { ComponentEntry } from "./componentsModel.ts";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type ComponentRowProps = {
  entry: ComponentEntry;
  isBusy: boolean;
  onCustomizeRequested: () => void;
  onEditRequested: () => void;
};

const ComponentRow = ({
  entry,
  isBusy,
  onCustomizeRequested,
  onEditRequested,
}: ComponentRowProps) => (
  <li className="border-line flex items-center justify-between gap-3 rounded-md border p-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ink text-sm font-medium">{entry.label}</span>
      <span className="text-ink-muted truncate font-mono text-xs">
        {entry.path}
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      {entry.override === "theme-changed" && (
        <span className="text-ink-secondary flex items-center gap-1.5 text-xs">
          <StatusDot tone="attention" />
          Theme changed
        </span>
      )}
      {entry.override !== null && (
        <span className="text-ink-secondary flex items-center gap-1.5 text-xs">
          <StatusDot tone="progress" />
          Customized
        </span>
      )}
      {entry.override === null ? (
        <button
          type="button"
          aria-label={`Customize ${entry.label}`}
          disabled={isBusy}
          onClick={onCustomizeRequested}
          className={secondaryButtonClasses}
        >
          Customize
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Edit ${entry.label}`}
          onClick={onEditRequested}
          className={secondaryButtonClasses}
        >
          Edit
        </button>
      )}
    </div>
  </li>
);

export default ComponentRow;
