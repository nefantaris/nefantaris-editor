import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import type { BlockChoice } from "./blockGroups.ts";
import { blockGroupsFrom } from "./blockGroups.ts";

type InsertDirectiveModalProps = {
  blocks: BlockChoice[];
  onPicked: (name: string) => void;
  onClose: () => void;
};

const InsertDirectiveModal = ({
  blocks,
  onPicked,
  onClose,
}: InsertDirectiveModalProps) => {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const hasDirectives = blocks.length > 0;
  const groups = blockGroupsFrom(blocks);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const list = listRef.current;
    if (!list) {
      return;
    }
    const buttons = [...list.querySelectorAll("button")];
    if (buttons.length === 0) {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const active = document.activeElement;
    const activeIndex =
      active instanceof HTMLButtonElement ? buttons.indexOf(active) : -1;
    const nextIndex = (activeIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  };

  useEffect(() => {
    if (hasDirectives) {
      listRef.current?.querySelector("button")?.focus();
    }
  }, [hasDirectives]);

  return (
    <ModalDialog title="Insert a block" onClose={onClose}>
      {hasDirectives ? (
        <div ref={listRef} className="flex flex-col gap-3">
          {groups.map((group, groupIndex) => {
            const headingId = `${baseId}-group-${groupIndex}`;
            return (
              <section
                key={group.title}
                aria-labelledby={headingId}
                className="flex flex-col gap-1"
              >
                <h3
                  id={headingId}
                  className="text-ink-muted px-3 text-xs font-medium"
                >
                  {group.title}
                </h3>
                <ul aria-labelledby={headingId} className="flex flex-col gap-1">
                  {group.blocks.map((block) => (
                    <li key={block.name}>
                      <button
                        onClick={() => onPicked(block.name)}
                        onKeyDown={moveFocus}
                        className="hover:bg-raised flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors duration-100"
                      >
                        <span className="text-ink text-sm font-medium">
                          {block.label}
                        </span>
                        {block.description !== null && (
                          <span className="text-ink-muted text-xs">
                            {block.description}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-ink-muted text-sm">
          This site's theme has no insertable blocks.
        </p>
      )}
    </ModalDialog>
  );
};

export default InsertDirectiveModal;
