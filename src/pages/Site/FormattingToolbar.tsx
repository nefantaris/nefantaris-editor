import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BoldIcon,
  BulletListIcon,
  ChecklistIcon,
  CodeBlockIcon,
  DividerIcon,
  GalleryIcon,
  ImageIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
  PlusIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
} from "../../components/Icons.tsx";
import type { EditorCommand } from "./formatting/editorCommands.ts";
import type { FormattingState } from "./formatting/formattingState.ts";
import type { HeadingLevel } from "./formatting/lineFormatting.ts";
import TextStyleMenu from "./TextStyleMenu.tsx";
import type { ToolbarShortcut } from "./ToolbarButton.tsx";
import ToolbarButton from "./ToolbarButton.tsx";

type FormattingToolbarProps = {
  formatting: FormattingState;
  hasGallery: boolean;
  hasBlocks: boolean;
  onCommand: (command: EditorCommand) => void;
  onHeadingChosen: (level: HeadingLevel) => void;
};

type ToolbarAction = {
  command: EditorCommand;
  label: string;
  icon: ReactNode;
  shortcutKey?: string;
  pressedKey?: keyof FormattingState;
};

const isMac = globalThis.navigator.userAgent.includes("Mac");

function shortcutFor(key: string | undefined): ToolbarShortcut | undefined {
  if (key === undefined) {
    return undefined;
  }
  const isShifted = key.startsWith("Shift+");
  const letter = key.replace("Shift+", "");
  return {
    aria: `${isMac ? "Meta" : "Control"}+${key}`,
    text: isMac
      ? `${isShifted ? "⇧" : ""}⌘${letter}`
      : `Ctrl+${isShifted ? "Shift+" : ""}${letter}`,
  };
}

const actionGroups: ToolbarAction[][] = [
  [
    {
      command: "bold",
      label: "Bold",
      icon: <BoldIcon />,
      shortcutKey: "B",
      pressedKey: "bold",
    },
    {
      command: "italic",
      label: "Italic",
      icon: <ItalicIcon />,
      shortcutKey: "I",
      pressedKey: "italic",
    },
    {
      command: "strikethrough",
      label: "Strikethrough",
      icon: <StrikethroughIcon />,
      shortcutKey: "Shift+X",
      pressedKey: "strikethrough",
    },
    {
      command: "code",
      label: "Code",
      icon: <InlineCodeIcon />,
      pressedKey: "code",
    },
    {
      command: "link",
      label: "Link",
      icon: <LinkIcon />,
      shortcutKey: "K",
      pressedKey: "link",
    },
  ],
  [
    {
      command: "bullet",
      label: "Bulleted list",
      icon: <BulletListIcon />,
      pressedKey: "bullet",
    },
    {
      command: "numbered",
      label: "Numbered list",
      icon: <NumberedListIcon />,
      pressedKey: "numbered",
    },
    {
      command: "task",
      label: "Checklist",
      icon: <ChecklistIcon />,
      pressedKey: "task",
    },
    {
      command: "quote",
      label: "Quote",
      icon: <QuoteIcon />,
      pressedKey: "quote",
    },
  ],
  [
    { command: "codeBlock", label: "Code block", icon: <CodeBlockIcon /> },
    { command: "divider", label: "Divider", icon: <DividerIcon /> },
    { command: "table", label: "Table", icon: <TableIcon /> },
    { command: "image", label: "Image", icon: <ImageIcon /> },
    { command: "gallery", label: "Gallery", icon: <GalleryIcon /> },
  ],
];

const toolbarKeys = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

const Separator = () => (
  <span role="separator" className="bg-line mx-1 h-5 w-px" />
);

const FormattingToolbar = ({
  formatting,
  hasGallery,
  hasBlocks,
  onCommand,
  onHeadingChosen,
}: FormattingToolbarProps) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isDisabled = !formatting.isAvailable;
  const groups = actionGroups.map((group) =>
    group.filter((action) => action.command !== "gallery" || hasGallery),
  );
  const groupStarts = groups.map(
    (_, groupIndex) =>
      1 +
      groups
        .slice(0, groupIndex)
        .reduce((total, group) => total + group.length, 0),
  );
  const insertBlockIndex =
    1 + groups.reduce((total, group) => total + group.length, 0);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!toolbarKeys.has(event.key)) {
      return;
    }
    const items = [
      ...(toolbarRef.current?.querySelectorAll<HTMLElement>(
        "[data-toolbar-item]",
      ) ?? []),
    ];
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? items.indexOf(active) : -1;
    if (current === -1) {
      return;
    }
    event.preventDefault();
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + items.length) %
            items.length;
    items[target]?.focus();
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={moveFocus}
      className="border-line bg-surface flex shrink-0 flex-wrap items-center gap-0.5 border-b px-3 py-1"
    >
      <TextStyleMenu
        headingLevel={formatting.headingLevel}
        isDisabled={isDisabled}
        isTabStop={activeIndex === 0}
        onFocused={() => setActiveIndex(0)}
        onStyleChosen={onHeadingChosen}
      />
      {groups.map((group, groupIndex) => (
        <span key={group[0].command} className="flex items-center gap-0.5">
          <Separator />
          {group.map((action, actionIndex) => {
            const index = groupStarts[groupIndex] + actionIndex;
            return (
              <ToolbarButton
                key={action.command}
                label={action.label}
                icon={action.icon}
                shortcut={shortcutFor(action.shortcutKey)}
                isPressed={
                  action.pressedKey === undefined
                    ? undefined
                    : formatting[action.pressedKey] === true
                }
                isDisabled={isDisabled}
                isTabStop={activeIndex === index}
                onFocused={() => setActiveIndex(index)}
                onClicked={() => onCommand(action.command)}
              />
            );
          })}
        </span>
      ))}
      <Separator />
      <InsertBlockButton
        isDisabled={isDisabled || !hasBlocks}
        isTabStop={activeIndex === insertBlockIndex}
        index={insertBlockIndex}
        onFocused={setActiveIndex}
        onClicked={() => onCommand("insertBlock")}
      />
    </div>
  );
};

type InsertBlockButtonProps = {
  isDisabled: boolean;
  isTabStop: boolean;
  index: number;
  onFocused: (index: number) => void;
  onClicked: () => void;
};

const InsertBlockButton = ({
  isDisabled,
  isTabStop,
  index,
  onFocused,
  onClicked,
}: InsertBlockButtonProps) => (
  <button
    type="button"
    data-toolbar-item
    aria-disabled={isDisabled || undefined}
    aria-keyshortcuts={isMac ? "Meta+/" : "Control+/"}
    tabIndex={isTabStop ? 0 : -1}
    onFocus={() => onFocused(index)}
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => {
      if (!isDisabled) {
        onClicked();
      }
    }}
    className="text-ink-secondary hover:bg-raised hover:text-ink aria-disabled:text-ink-disabled flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors duration-100 aria-disabled:cursor-default aria-disabled:hover:bg-transparent"
  >
    <PlusIcon />
    Insert block
  </button>
);

export default FormattingToolbar;
