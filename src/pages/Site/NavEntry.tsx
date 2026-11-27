import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import AutosaveTextField from "./AutosaveTextField.tsx";
import NavLinkField from "./NavLinkField.tsx";
import { iconButtonClasses } from "./settingsStyles.ts";
import type { LinkOptions, NavEntryRow } from "./siteSettingsModel.ts";
import { linkLabelProblem } from "./siteSettingsModel.ts";

export type NavMoveDirection = "up" | "down";

type NavEntryProps = {
  row: NavEntryRow;
  position: string;
  isFirst: boolean;
  isLast: boolean;
  isTopLevel: boolean;
  linkOptions: LinkOptions;
  onLabelCommitted: (rowId: string, label: string) => void;
  onHrefCommitted: (rowId: string, href: string) => void;
  onMoveRequested: (rowId: string, direction: NavMoveDirection) => void;
  onRemoveRequested: (rowId: string) => void;
  onAddChildRequested: (rowId: string) => void;
};

function tuckedAwayNote(count: number): string {
  return count === 1
    ? "It also has 1 more link tucked under it, which stays as it is."
    : `It also has ${count} more links tucked under it, which stay as they are.`;
}

const NavEntry = ({
  row,
  position,
  isFirst,
  isLast,
  isTopLevel,
  linkOptions,
  onLabelCommitted,
  onHrefCommitted,
  onMoveRequested,
  onRemoveRequested,
  onAddChildRequested,
}: NavEntryProps) => {
  const spokenName =
    row.label.trim() === "" ? `link ${position}` : row.label.trim();

  return (
    <li
      data-nav-row={row.id}
      className={classNames(
        "flex flex-col gap-3",
        isTopLevel
          ? "border-line rounded-md border p-3"
          : "border-line border-l-2 pl-3",
      )}
    >
      <fieldset className="flex flex-wrap items-start gap-3">
        <legend className="sr-only">{`Link ${position}`}</legend>
        {row.isEditable ? (
          <>
            <AutosaveTextField
              label="Label"
              value={row.label}
              validate={linkLabelProblem}
              onCommit={(label) => onLabelCommitted(row.id, label.trim())}
              className="w-40 grow"
            />
            <NavLinkField
              href={row.href}
              linkOptions={linkOptions}
              onCommit={(href) => onHrefCommitted(row.id, href)}
              className="w-56 grow"
            />
          </>
        ) : (
          <p className="text-ink-muted grow text-sm">
            This link is set up in a way this screen can&rsquo;t change, so it
            stays as it is.
          </p>
        )}
        <div className="flex items-center gap-0.5 pt-5">
          <button
            type="button"
            data-nav-control="up"
            aria-label={`Move ${spokenName} up`}
            disabled={isFirst}
            onClick={() => onMoveRequested(row.id, "up")}
            className={iconButtonClasses}
          >
            <ArrowUpIcon />
          </button>
          <button
            type="button"
            data-nav-control="down"
            aria-label={`Move ${spokenName} down`}
            disabled={isLast}
            onClick={() => onMoveRequested(row.id, "down")}
            className={iconButtonClasses}
          >
            <ArrowDownIcon />
          </button>
          <button
            type="button"
            data-nav-control="remove"
            aria-label={`Remove ${spokenName}`}
            onClick={() => onRemoveRequested(row.id)}
            className={classNames(iconButtonClasses, "hover:text-danger")}
          >
            <TrashIcon />
          </button>
        </div>
      </fieldset>
      {row.tuckedAwayCount > 0 && (
        <p className="text-ink-muted text-xs">
          {tuckedAwayNote(row.tuckedAwayCount)}
        </p>
      )}
      {isTopLevel && row.isEditable && (
        <div className="flex flex-col items-start gap-3 pl-4">
          {!!row.children.length && (
            <ul className="flex w-full flex-col gap-3">
              {row.children.map((child, index) => (
                <NavEntry
                  key={child.id}
                  row={child}
                  position={`${position}.${index + 1}`}
                  isFirst={index === 0}
                  isLast={index === row.children.length - 1}
                  isTopLevel={false}
                  linkOptions={linkOptions}
                  onLabelCommitted={onLabelCommitted}
                  onHrefCommitted={onHrefCommitted}
                  onMoveRequested={onMoveRequested}
                  onRemoveRequested={onRemoveRequested}
                  onAddChildRequested={onAddChildRequested}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            data-nav-control="add-child"
            onClick={() => onAddChildRequested(row.id)}
            className="text-ink-secondary hover:text-ink hover:bg-raised flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors duration-100"
          >
            <PlusIcon />
            {`Add a link under ${spokenName}`}
          </button>
        </div>
      )}
    </li>
  );
};

export default NavEntry;
