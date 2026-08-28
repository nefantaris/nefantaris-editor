import { useEffect, useRef, type KeyboardEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";

type InsertDirectiveModalProps = {
  directives: string[];
  onPicked: (name: string) => void;
  onClose: () => void;
};

const InsertDirectiveModal = ({
  directives,
  onPicked,
  onClose,
}: InsertDirectiveModalProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const hasDirectives = directives.length > 0;

  useEffect(() => {
    if (hasDirectives) {
      listRef.current?.querySelector("button")?.focus();
    }
  }, [hasDirectives]);

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

  return (
    <ModalDialog title="Insert a block" onClose={onClose}>
      {directives.length === 0 ? (
        <p className="text-brand-gray text-sm">
          This site's theme has no insertable blocks.
        </p>
      ) : (
        <ul
          ref={listRef}
          aria-label="Available blocks"
          className="flex flex-col gap-1"
        >
          {directives.map((name) => (
            <li key={name}>
              <button
                onClick={() => onPicked(name)}
                onKeyDown={moveFocus}
                className="text-brand-black hover:bg-brand-grayLight w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-100"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalDialog>
  );
};

export default InsertDirectiveModal;
