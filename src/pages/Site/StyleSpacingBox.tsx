import { useId, useState, type ReactNode } from "react";
import StatusDot from "../../components/StatusDot.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { BridgeStyles } from "./previewBridge.ts";
import {
  boxSides,
  propertyLabel,
  sideLabels,
  type BoxSide,
} from "./styleProperties.ts";
import StyleTextInput from "./StyleTextInput.tsx";
import {
  isLengthAccepted,
  nudgedLength,
  shownUnit,
  statusBadgeText,
  withUnit,
  type StyleFieldStatus,
} from "./styleValues.ts";

type SpacingKind = "margin" | "padding";

type StyleSpacingBoxProps = {
  declared: Map<string, string>;
  computed: BridgeStyles | null;
  statusOf: (property: string) => StyleFieldStatus;
  onChange: (property: string, value: string | null) => void;
};

const spacingKinds: SpacingKind[] = ["margin", "padding"];

const kindLabels: Record<SpacingKind, string> = {
  margin: "Margin",
  padding: "Padding",
};

const sideCells: Record<BoxSide, string> = {
  top: "col-start-2 row-start-1",
  right: "col-start-3 row-start-2",
  bottom: "col-start-2 row-start-3",
  left: "col-start-1 row-start-2",
};

const StyleSpacingBox = ({
  declared,
  computed,
  statusOf,
  onChange,
}: StyleSpacingBoxProps) => {
  const headingId = useId();
  const errorId = useId();
  const [invalidProperties, setInvalidProperties] = useState<string[]>([]);

  const shownProperties = spacingKinds.flatMap((kind) =>
    boxSides
      .map((side) => `${kind}-${side}`)
      .filter((property) => {
        const status = statusOf(property);
        return status.isSet || status.inheritedFrom !== null;
      }),
  );

  const changeInvalid = (property: string, isInvalid: boolean) => {
    setInvalidProperties((current) =>
      isInvalid
        ? [...new Set([...current, property])]
        : current.filter((entry) => entry !== property),
    );
  };

  const sideInput = (kind: SpacingKind, side: BoxSide): ReactNode => {
    const property = `${kind}-${side}`;
    const value = declared.get(property) ?? "";
    const placeholder = computed?.[property] ?? "";
    const isSet = statusOf(property).isSet;
    return (
      <div key={property} className={classNames("flex", sideCells[side])}>
        <StyleTextInput
          aria-label={`${kindLabels[kind]} ${sideLabels[side].toLowerCase()}`}
          aria-errormessage={errorId}
          value={value}
          placeholder={placeholder}
          inputMode="decimal"
          errorMessage=""
          isErrorTextShown={false}
          isValid={(text) => isLengthAccepted(property, text, "px")}
          onCommit={(text) =>
            onChange(property, text === "" ? null : withUnit(text, "px"))
          }
          onNudge={(text, keys) =>
            nudgedLength(
              text,
              placeholder,
              shownUnit(text, "px"),
              keys,
              kind === "margin",
            )
          }
          onInvalidChanged={(isInvalid) => changeInvalid(property, isInvalid)}
          className={classNames(
            "w-12 px-0.5 py-1 text-center text-xs",
            isSet && "ring-primary ring-1",
          )}
        />
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
    >
      <span id={headingId} className="text-ink text-sm font-medium">
        Margin and padding
      </span>
      <div className="border-line bg-sunken flex flex-col gap-1 rounded-md border border-dashed p-2">
        <span className="text-ink-muted text-xs">Margin, outside</span>
        <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] items-center justify-items-center gap-1">
          {boxSides.map((side) => sideInput("margin", side))}
          <div className="border-line bg-surface col-start-2 row-start-2 flex w-full flex-col gap-1 rounded-md border p-2">
            <span className="text-ink-muted text-xs">Padding, inside</span>
            <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] items-center justify-items-center gap-1">
              {boxSides.map((side) => sideInput("padding", side))}
              <span className="bg-raised text-ink-muted col-start-2 row-start-2 rounded-md px-1 py-2 text-xs">
                Content
              </span>
            </div>
          </div>
        </div>
      </div>
      {invalidProperties.length > 0 && (
        <p id={errorId} className="text-danger text-xs">
          Use a size like 16, 1.5rem, or auto.
        </p>
      )}
      {shownProperties.length > 0 && (
        <ul aria-label="Spacing styled here" className="flex flex-col gap-1">
          {shownProperties.map((property) => {
            const status = statusOf(property);
            const label = propertyLabel(property);
            return (
              <li
                key={property}
                className="text-ink-secondary flex flex-wrap items-center gap-2 text-xs"
              >
                <span>{label}</span>
                <span
                  className={classNames(
                    "flex items-center gap-1.5",
                    status.isSet ? "text-primary-ink" : "text-ink-muted",
                  )}
                >
                  <StatusDot tone={status.isSet ? "progress" : "quiet"} />
                  {statusBadgeText(status)}
                </span>
                {status.isSet && (
                  <button
                    type="button"
                    aria-label={`Reset ${label.toLowerCase()}`}
                    onClick={() => onChange(property, null)}
                    className="text-ink-secondary hover:text-ink hover:bg-raised ml-auto rounded-md px-2 py-0.5 font-medium transition-colors duration-100"
                  >
                    Reset
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StyleSpacingBox;
