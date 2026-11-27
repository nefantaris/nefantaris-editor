import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDownIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { HeadingLevel } from "./formatting/lineFormatting.ts";
import { toolbarControlClasses, tooltipClasses } from "./ToolbarButton.tsx";

type TextStyleMenuProps = {
  headingLevel: HeadingLevel | null;
  isDisabled: boolean;
  isTabStop: boolean;
  onFocused: () => void;
  onStyleChosen: (level: HeadingLevel) => void;
};

const textStyles: { level: HeadingLevel; label: string }[] = [
  { level: 0, label: "Paragraph" },
  { level: 2, label: "Heading 2" },
  { level: 3, label: "Heading 3" },
  { level: 4, label: "Heading 4" },
];

const menuItemSelector = '[role="menuitemradio"]';

const menuKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
]);

const HINT =
  "Choose how this text looks. The page title is already the top heading, so headings in your text start at Heading 2.";

function styleLabel(level: HeadingLevel | null): string {
  if (level === null) {
    return "Mixed";
  }
  return level === 0 ? "Paragraph" : `Heading ${level}`;
}

const TextStyleMenu = ({
  headingLevel,
  isDisabled,
  isTabStop,
  onFocused,
  onStyleChosen,
}: TextStyleMenuProps) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = styleLabel(headingLevel);

  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
      menuItemSelector,
    ) ?? []),
  ];

  const openMenu = () => {
    if (!isDisabled) {
      setIsOpen(true);
    }
  };

  const closeMenu = (shouldFocusButton: boolean) => {
    setIsOpen(false);
    if (shouldFocusButton) {
      buttonRef.current?.focus();
    }
  };

  const choose = (level: HeadingLevel) => {
    setIsOpen(false);
    onStyleChosen(level);
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    openMenu();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }
    if (!menuKeys.has(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      closeMenu(true);
      return;
    }
    const items = menuItems();
    const active = document.activeElement;
    const index =
      active instanceof HTMLButtonElement ? items.indexOf(active) : -1;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const target = moves[event.key];
    if (target !== undefined) {
      items[target]?.focus();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
        menuItemSelector,
      ) ?? []),
    ];
    (
      items.find((item) => item.getAttribute("aria-checked") === "true") ??
      items[0]
    )?.focus();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  return (
    <span ref={wrapperRef} className="group relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        data-toolbar-item
        aria-label={`Text style: ${currentLabel}`}
        aria-describedby={hintId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-disabled={isDisabled || undefined}
        tabIndex={isTabStop ? 0 : -1}
        onFocus={onFocused}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        onKeyDown={handleButtonKeyDown}
        className={classNames(
          toolbarControlClasses,
          "flex w-32 items-center justify-between gap-1 px-2 py-1 text-sm",
        )}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDownIcon className="shrink-0" />
      </button>
      <span
        id={hintId}
        role="tooltip"
        className={
          isOpen
            ? "sr-only"
            : classNames(tooltipClasses, "left-0 w-72 translate-x-0")
        }
      >
        {HINT}
      </span>
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Text style"
          onKeyDown={handleMenuKeyDown}
          className="bg-surface border-line absolute top-full left-0 z-20 mt-1 flex w-44 flex-col rounded-md border p-1"
        >
          {textStyles.map((style) => (
            <button
              key={style.level}
              type="button"
              role="menuitemradio"
              aria-checked={style.level === headingLevel}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(style.level)}
              className={classNames(
                "hover:bg-raised focus:bg-raised text-ink w-full rounded-md px-2 py-1.5 text-left transition-colors duration-100",
                style.level === 0 && "text-sm",
                style.level === 2 && "text-lg font-semibold",
                style.level === 3 && "text-base font-semibold",
                style.level === 4 && "text-sm font-semibold",
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

export default TextStyleMenu;
