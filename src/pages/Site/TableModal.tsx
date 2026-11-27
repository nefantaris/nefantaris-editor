import { useState, type KeyboardEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import { modalSecondaryButtonClasses } from "./settingsStyles.ts";

type TableModalProps = {
  onChosen: (columns: number, rows: number) => void;
  onClose: () => void;
};

type TableSize = { columns: number; rows: number };

const MAX_COLUMNS = 6;
const MAX_ROWS = 8;
const columnNumbers = Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1);
const rowNumbers = Array.from({ length: MAX_ROWS }, (_, i) => i + 1);

const arrowMoves: Record<string, TableSize> = {
  ArrowRight: { columns: 1, rows: 0 },
  ArrowLeft: { columns: -1, rows: 0 },
  ArrowDown: { columns: 0, rows: 1 },
  ArrowUp: { columns: 0, rows: -1 },
};

function sizeLabel({ columns, rows }: TableSize): string {
  return `${columns} ${columns === 1 ? "column" : "columns"}, ${rows} ${rows === 1 ? "row" : "rows"}`;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 1), max);
}

const TableModal = ({ onChosen, onClose }: TableModalProps) => {
  const [size, setSize] = useState<TableSize>({ columns: 1, rows: 1 });

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = arrowMoves[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    const next = {
      columns: clamp(size.columns + move.columns, MAX_COLUMNS),
      rows: clamp(size.rows + move.rows, MAX_ROWS),
    };
    setSize(next);
    document
      .querySelector<HTMLButtonElement>(
        `[data-table-size="${CSS.escape(`${next.columns}x${next.rows}`)}"]`,
      )
      ?.focus();
  };

  return (
    <ModalDialog title="Add a table" onClose={onClose}>
      <p className="text-ink-muted text-sm">
        Pick a size. A heading row for column names is added on top.
      </p>
      <div className="flex flex-col items-center gap-2">
        <div aria-hidden="true" className="grid grid-cols-6 gap-1">
          {columnNumbers.map((column) => (
            <span
              key={column}
              className={classNames(
                "h-3 w-7 rounded-md",
                column <= size.columns ? "bg-primary" : "bg-raised",
              )}
            />
          ))}
        </div>
        <div
          role="group"
          aria-label="Table size"
          className="grid grid-cols-6 gap-1"
        >
          {rowNumbers.flatMap((row) =>
            columnNumbers.map((column) => {
              const cell = { columns: column, rows: row };
              const isInside = column <= size.columns && row <= size.rows;
              const isCurrent = column === size.columns && row === size.rows;
              return (
                <button
                  key={`${column}x${row}`}
                  type="button"
                  data-table-size={`${column}x${row}`}
                  aria-label={sizeLabel(cell)}
                  tabIndex={isCurrent ? 0 : -1}
                  onMouseEnter={() => setSize(cell)}
                  onFocus={() => setSize(cell)}
                  onKeyDown={moveFocus}
                  onClick={() => onChosen(column, row)}
                  className={classNames(
                    "h-7 w-7 rounded-md border transition-colors duration-100",
                    isInside
                      ? "border-primary bg-primary/15"
                      : "border-line bg-surface",
                  )}
                />
              );
            }),
          )}
        </div>
        <p aria-live="polite" className="text-ink-secondary text-sm">
          {sizeLabel(size)}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
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
};

export default TableModal;
