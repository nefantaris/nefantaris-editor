import { useEffect, useRef, useState } from "react";
import type {
  JsonValue,
  SiteConfigEdit,
  SiteConfigPath,
} from "../../../electron/ipcContract.cts";
import { PlusIcon } from "../../components/Icons.tsx";
import NavEntry, { type NavMoveDirection } from "./NavEntry.tsx";
import { secondaryButtonClasses } from "./settingsStyles.ts";
import type { LinkOptions, NavEntryRow } from "./siteSettingsModel.ts";
import { navRowsFrom, navSignature } from "./siteSettingsModel.ts";

type NavigationEditorProps = {
  nav: JsonValue | undefined;
  linkOptions: LinkOptions;
  onEdit: (edits: SiteConfigEdit[]) => void;
};

type RowPosition = { index: number; childIndex: number | null };

type FocusRequest = { rowId: string | null; selectors: string[] };

const NEW_LINK = { label: "New link", href: "/" };

let navRowCounter = 0;

function nextNavRowId(): string {
  navRowCounter += 1;
  return `nav-row-${navRowCounter}`;
}

function blankId(): string {
  return "";
}

function diskSignatureOf(nav: JsonValue | undefined): string {
  return navSignature(navRowsFrom(nav, blankId));
}

function newRow(): NavEntryRow {
  return {
    id: nextNavRowId(),
    ...NEW_LINK,
    isEditable: true,
    tuckedAwayCount: 0,
    children: [],
  };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  return items.toSpliced(from, 1).toSpliced(to, 0, items[from]);
}

function controlSelector(control: string): string {
  return `[data-nav-control="${control}"]`;
}

function pathOf(position: RowPosition): SiteConfigPath {
  return position.childIndex === null
    ? ["nav", position.index]
    : ["nav", position.index, "children", position.childIndex];
}

const NavigationEditor = ({
  nav,
  linkOptions,
  onEdit,
}: NavigationEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusRequestRef = useRef<FocusRequest | null>(null);
  const [rows, setRows] = useState(() => navRowsFrom(nav, nextNavRowId));
  const [seenDiskSignature, setSeenDiskSignature] = useState(() =>
    diskSignatureOf(nav),
  );

  const diskSignature = diskSignatureOf(nav);
  if (diskSignature !== seenDiskSignature) {
    setSeenDiskSignature(diskSignature);
    if (diskSignature !== navSignature(rows)) {
      setRows(navRowsFrom(nav, nextNavRowId));
    }
  }

  const locate = (rowId: string): RowPosition | null => {
    for (const [index, row] of rows.entries()) {
      if (row.id === rowId) {
        return { index, childIndex: null };
      }
      const childIndex = row.children.findIndex((child) => child.id === rowId);
      if (childIndex !== -1) {
        return { index, childIndex };
      }
    }
    return null;
  };

  const applyChange = (
    nextRows: NavEntryRow[],
    edits: SiteConfigEdit[],
    focusRequest: FocusRequest | null,
  ) => {
    focusRequestRef.current = focusRequest;
    setRows(nextRows);
    onEdit(edits);
  };

  const updateRow = (
    rowId: string,
    update: (row: NavEntryRow) => NavEntryRow,
  ): NavEntryRow[] =>
    rows.map((row) =>
      row.id === rowId
        ? update(row)
        : {
            ...row,
            children: row.children.map((child) =>
              child.id === rowId ? update(child) : child,
            ),
          },
    );

  const commitLabel = (rowId: string, label: string) => {
    const position = locate(rowId);
    if (position === null) {
      return;
    }
    applyChange(
      updateRow(rowId, (row) => ({ ...row, label })),
      [{ kind: "set", path: [...pathOf(position), "label"], value: label }],
      null,
    );
  };

  const commitHref = (rowId: string, href: string) => {
    const position = locate(rowId);
    if (position === null) {
      return;
    }
    applyChange(
      updateRow(rowId, (row) => ({ ...row, href })),
      [{ kind: "set", path: [...pathOf(position), "href"], value: href }],
      null,
    );
  };

  const moveRow = (rowId: string, direction: NavMoveDirection) => {
    const position = locate(rowId);
    if (position === null) {
      return;
    }
    const step = direction === "up" ? -1 : 1;
    const opposite = direction === "up" ? "down" : "up";
    const focusRequest = {
      rowId,
      selectors: [controlSelector(direction), controlSelector(opposite)],
    };
    if (position.childIndex === null) {
      const target = position.index + step;
      if (target < 0 || target >= rows.length) {
        return;
      }
      applyChange(
        moveItem(rows, position.index, target),
        [{ kind: "move", path: ["nav"], from: position.index, to: target }],
        focusRequest,
      );
      return;
    }
    const { index, childIndex } = position;
    const target = childIndex + step;
    if (target < 0 || target >= rows[index].children.length) {
      return;
    }
    applyChange(
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, children: moveItem(row.children, childIndex, target) }
          : row,
      ),
      [
        {
          kind: "move",
          path: ["nav", index, "children"],
          from: childIndex,
          to: target,
        },
      ],
      focusRequest,
    );
  };

  const removeRow = (rowId: string) => {
    const position = locate(rowId);
    if (position === null) {
      return;
    }
    const { index, childIndex } = position;
    const removeFocus = [controlSelector("remove")];
    if (childIndex === null) {
      const remaining = rows.toSpliced(index, 1);
      const neighbour = remaining[index] ?? remaining[index - 1];
      applyChange(
        remaining,
        [{ kind: "remove", path: ["nav", index] }],
        neighbour
          ? { rowId: neighbour.id, selectors: removeFocus }
          : { rowId: null, selectors: [controlSelector("add")] },
      );
      return;
    }
    const parent = rows[index];
    const remainingChildren = parent.children.toSpliced(childIndex, 1);
    const neighbour =
      remainingChildren[childIndex] ?? remainingChildren[childIndex - 1];
    applyChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, children: remainingChildren } : row,
      ),
      [
        {
          kind: "remove",
          path:
            remainingChildren.length === 0
              ? ["nav", index, "children"]
              : ["nav", index, "children", childIndex],
        },
      ],
      neighbour
        ? { rowId: neighbour.id, selectors: removeFocus }
        : { rowId: parent.id, selectors: [controlSelector("add-child")] },
    );
  };

  const addRow = () => {
    const added = newRow();
    applyChange(
      [...rows, added],
      [
        Array.isArray(nav)
          ? { kind: "insert", path: ["nav", rows.length], value: NEW_LINK }
          : { kind: "set", path: ["nav"], value: [NEW_LINK] },
      ],
      { rowId: added.id, selectors: ["input"] },
    );
  };

  const addChildRow = (rowId: string) => {
    const position = locate(rowId);
    if (position === null) {
      return;
    }
    const parent = rows[position.index];
    const added = newRow();
    applyChange(
      rows.map((row, rowIndex) =>
        rowIndex === position.index
          ? { ...row, children: [...row.children, added] }
          : row,
      ),
      [
        parent.children.length === 0
          ? {
              kind: "set",
              path: ["nav", position.index, "children"],
              value: [NEW_LINK],
            }
          : {
              kind: "insert",
              path: ["nav", position.index, "children", parent.children.length],
              value: NEW_LINK,
            },
      ],
      { rowId: added.id, selectors: ["input"] },
    );
  };

  useEffect(() => {
    const request = focusRequestRef.current;
    focusRequestRef.current = null;
    const container = containerRef.current;
    if (request === null || container === null) {
      return;
    }
    const scope =
      request.rowId === null
        ? container
        : container.querySelector(
            `[data-nav-row="${CSS.escape(request.rowId)}"]`,
          );
    const target = request.selectors
      .map((selector) => scope?.querySelector<HTMLElement>(selector))
      .find((element) => element && !element.matches(":disabled"));
    target?.focus();
    if (target instanceof HTMLInputElement) {
      target.select();
    }
  }, [rows]);

  return (
    <div ref={containerRef} className="flex flex-col items-start gap-3">
      {rows.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Your site&rsquo;s menu has no links yet.
        </p>
      ) : (
        <ul className="flex w-full flex-col gap-3">
          {rows.map((row, index) => (
            <NavEntry
              key={row.id}
              row={row}
              position={String(index + 1)}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              isTopLevel
              linkOptions={linkOptions}
              onLabelCommitted={commitLabel}
              onHrefCommitted={commitHref}
              onMoveRequested={moveRow}
              onRemoveRequested={removeRow}
              onAddChildRequested={addChildRow}
            />
          ))}
        </ul>
      )}
      <button
        type="button"
        data-nav-control="add"
        onClick={addRow}
        className={secondaryButtonClasses}
      >
        <PlusIcon />
        Add a link
      </button>
    </div>
  );
};

export default NavigationEditor;
