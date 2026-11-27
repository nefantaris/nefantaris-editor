import { useEffect, useId, useRef, useState } from "react";
import type { DevVariable } from "../../../electron/ipcContract.cts";
import { PlusIcon, TrashIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import {
  blockInputClasses,
  iconButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type DevVarsEditorProps = {
  sitePath: string;
};

type SecretRow = DevVariable & {
  id: number;
  isShown: boolean;
};

const SAVE_DELAY_MS = 500;
const secretNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function problemOf(row: SecretRow, rows: SecretRow[]): string | null {
  const name = row.name.trim();
  if (name === "") {
    return row.value === "" ? null : "Give this secret a name.";
  }
  if (!secretNamePattern.test(name)) {
    return "Use only letters, numbers, and _, and don’t start with a number.";
  }
  const isRepeated = rows.some(
    (other) => other.id !== row.id && other.name.trim() === name,
  );
  return isRepeated ? "Another secret already has this name." : null;
}

function variablesOf(rows: SecretRow[]): DevVariable[] {
  return rows
    .filter((row) => row.name.trim() !== "")
    .map((row) => ({ name: row.name.trim(), value: row.value }));
}

const DevVarsEditor = ({ sitePath }: DevVarsEditorProps) => {
  const baseId = useId();
  const nextIdRef = useRef(0);
  const focusRowIdRef = useRef<number | null>(null);
  const [rows, setRows] = useState<SecretRow[] | null>(null);
  const [isIgnored, setIsIgnored] = useState(true);

  const save = useDebouncedCallback((nextRows: SecretRow[]) => {
    const hasProblem = nextRows.some(
      (row) => problemOf(row, nextRows) !== null,
    );
    if (!hasProblem) {
      void globalThis.nefantaris.invoke(
        "devVars:write",
        sitePath,
        variablesOf(nextRows),
      );
    }
  }, SAVE_DELAY_MS);

  const rowsFrom = (variables: DevVariable[]): SecretRow[] =>
    variables.map((variable) => {
      nextIdRef.current += 1;
      return { ...variable, id: nextIdRef.current, isShown: false };
    });

  const changeRows = (nextRows: SecretRow[]) => {
    setRows(nextRows);
    save.schedule(nextRows);
  };

  const updateRow = (id: number, change: Partial<SecretRow>) => {
    if (rows !== null) {
      changeRows(
        rows.map((row) => (row.id === id ? { ...row, ...change } : row)),
      );
    }
  };

  const toggleShown = (id: number) => {
    if (rows !== null) {
      setRows(
        rows.map((row) =>
          row.id === id ? { ...row, isShown: !row.isShown } : row,
        ),
      );
    }
  };

  const addRow = () => {
    nextIdRef.current += 1;
    focusRowIdRef.current = nextIdRef.current;
    setRows([
      ...(rows ?? []),
      { id: nextIdRef.current, name: "", value: "", isShown: false },
    ]);
  };

  const keepPrivate = async () => {
    const state = await globalThis.nefantaris.invoke(
      "devVars:ignore",
      sitePath,
    );
    setIsIgnored(state.isIgnored);
  };

  useEffect(() => {
    const load = async () => {
      const state = await globalThis.nefantaris.invoke(
        "devVars:read",
        sitePath,
      );
      setRows(rowsFrom(state.variables));
      setIsIgnored(state.isIgnored);
    };
    void load();
  }, [sitePath]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-ink text-sm font-medium">Secrets for the preview</h3>
      {!isIgnored && (
        <div
          role="alert"
          className="border-danger flex flex-col items-start gap-2 rounded-md border p-3"
        >
          <p className="text-danger text-sm">
            Your site&rsquo;s .gitignore doesn&rsquo;t list .dev.vars.
            Nefantaris never publishes it, but other tools could upload your
            secrets with the rest of your site.
          </p>
          <button
            type="button"
            onClick={() => void keepPrivate()}
            className={secondaryButtonClasses}
          >
            Add .dev.vars to .gitignore
          </button>
        </div>
      )}
      {rows !== null && rows.length === 0 && (
        <p className="text-ink-muted text-sm">No secrets yet</p>
      )}
      {rows !== null && rows.length > 0 && (
        <ul
          aria-label="Secrets for the preview"
          className="flex flex-col gap-2"
        >
          {rows.map((row) => {
            const problem = problemOf(row, rows);
            const shownName =
              row.name.trim() === "" ? "this secret" : row.name.trim();
            const problemId = `${baseId}-${row.id}-problem`;
            return (
              <li key={row.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={(element) => {
                      if (
                        element === null ||
                        focusRowIdRef.current !== row.id
                      ) {
                        return;
                      }
                      focusRowIdRef.current = null;
                      element.focus();
                    }}
                    type="text"
                    aria-label="Secret name"
                    aria-invalid={problem !== null || undefined}
                    aria-describedby={problem === null ? undefined : problemId}
                    placeholder="NAME"
                    spellCheck={false}
                    autoComplete="off"
                    value={row.name}
                    onChange={(event) =>
                      updateRow(row.id, { name: event.target.value })
                    }
                    onBlur={save.flush}
                    className={classNames(
                      blockInputClasses,
                      "min-w-0 flex-1 basis-40 font-mono",
                      problem !== null && "ring-danger ring-1",
                    )}
                  />
                  <input
                    type={row.isShown ? "text" : "password"}
                    aria-label="Secret value"
                    placeholder="Value"
                    spellCheck={false}
                    autoComplete="off"
                    value={row.value}
                    onChange={(event) =>
                      updateRow(row.id, { value: event.target.value })
                    }
                    onBlur={save.flush}
                    className={classNames(
                      blockInputClasses,
                      "min-w-0 flex-[2] basis-56 font-mono",
                    )}
                  />
                  <button
                    type="button"
                    aria-label={`${row.isShown ? "Hide" : "Show"} the value of ${shownName}`}
                    onClick={() => toggleShown(row.id)}
                    className={secondaryButtonClasses}
                  >
                    {row.isShown ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${shownName}`}
                    onClick={() =>
                      changeRows(
                        rows.filter((candidate) => candidate.id !== row.id),
                      )
                    }
                    className={iconButtonClasses}
                  >
                    <TrashIcon />
                  </button>
                </div>
                {problem !== null && (
                  <p id={problemId} className="text-danger text-xs">
                    {problem}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        disabled={rows === null}
        onClick={addRow}
        className={classNames(secondaryButtonClasses, "self-start")}
      >
        <PlusIcon />
        Add a secret
      </button>
    </div>
  );
};

export default DevVarsEditor;
