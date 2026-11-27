import { useId, useRef, useState, type KeyboardEvent } from "react";
import { classNames } from "../../utils/classNames.ts";
import { siteSectionEntries, type SiteSection } from "./siteSections.ts";

type ActivityRailProps = {
  activeSection: SiteSection;
  onSectionSelected: (section: SiteSection) => void;
};

function focusTargetIndex(
  key: string,
  index: number,
  count: number,
): number | null {
  switch (key) {
    case "ArrowDown": {
      return (index + 1) % count;
    }
    case "ArrowUp": {
      return (index - 1 + count) % count;
    }
    case "Home": {
      return 0;
    }
    case "End": {
      return count - 1;
    }
    default: {
      return null;
    }
  }
}

const ActivityRail = ({
  activeSection,
  onSectionSelected,
}: ActivityRailProps) => {
  const railId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [dismissedTooltip, setDismissedTooltip] = useState<SiteSection | null>(
    null,
  );

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    section: SiteSection,
  ) => {
    if (event.key === "Escape") {
      setDismissedTooltip(section);
      return;
    }
    const targetIndex = focusTargetIndex(
      event.key,
      index,
      siteSectionEntries.length,
    );
    if (targetIndex === null) {
      return;
    }
    event.preventDefault();
    buttonRefs.current[targetIndex]?.focus();
  };

  return (
    <nav
      aria-label="Site sections"
      className="border-line bg-sunken flex w-14 shrink-0 flex-col items-center border-r py-2"
    >
      <ul className="flex flex-col gap-1">
        {siteSectionEntries.map(({ section, label, Icon }, index) => {
          const isActive = section === activeSection;
          const tooltipId = `${railId}-${section}`;
          return (
            <li key={section} className="relative">
              <button
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                aria-labelledby={tooltipId}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSectionSelected(section)}
                onKeyDown={(event) => handleKeyDown(event, index, section)}
                onBlur={() => setDismissedTooltip(null)}
                onPointerLeave={() => setDismissedTooltip(null)}
                className={classNames(
                  "peer relative flex size-10 items-center justify-center rounded-md transition-colors duration-100",
                  isActive
                    ? "bg-raised text-ink"
                    : "text-ink-muted hover:bg-raised hover:text-ink",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="bg-primary absolute inset-y-2 -left-2 w-0.5 rounded-md"
                  />
                )}
                <Icon className="size-5" />
              </button>
              <span
                id={tooltipId}
                role="tooltip"
                className={classNames(
                  "bg-tooltip text-on-tooltip pointer-events-none invisible absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap",
                  dismissedTooltip !== section &&
                    "peer-hover:visible peer-focus-visible:visible",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default ActivityRail;
