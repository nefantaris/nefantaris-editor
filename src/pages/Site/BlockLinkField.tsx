import { useState } from "react";
import LinkOptionGroups, { ROUTE_CHOICE_PREFIX } from "./LinkOptionGroups.tsx";
import type { LinkOptions } from "./siteSettingsModel.ts";

type BlockLinkFieldProps = {
  id: string;
  label: string;
  describedBy?: string;
  value: string;
  linkOptions: LinkOptions;
  placeholder?: string;
  isRequired: boolean;
  isInvalid: boolean;
  onChange: (value: string) => void;
};

const ADDRESS_CHOICE = "address";
const NO_LINK_CHOICE = "none";

const inputClasses =
  "bg-field text-ink border-transparent focus:ring-primary w-full rounded-md border px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none";

const BlockLinkField = ({
  id,
  label,
  describedBy,
  value,
  linkOptions,
  placeholder = "https://example.com",
  isRequired,
  isInvalid,
  onChange,
}: BlockLinkFieldProps) => {
  const [isTypingAddress, setIsTypingAddress] = useState(false);

  const knownRoutes = [...linkOptions.pages, ...linkOptions.posts].map(
    (option) => option.route,
  );
  const isAddress =
    isTypingAddress || (value !== "" && !knownRoutes.includes(value));
  const choice = isAddress
    ? ADDRESS_CHOICE
    : value === ""
      ? NO_LINK_CHOICE
      : `${ROUTE_CHOICE_PREFIX}${value}`;

  const chooseOption = (next: string) => {
    setIsTypingAddress(next === ADDRESS_CHOICE);
    if (next === NO_LINK_CHOICE) {
      onChange("");
    } else if (next.startsWith(ROUTE_CHOICE_PREFIX)) {
      onChange(next.slice(ROUTE_CHOICE_PREFIX.length));
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <select
        id={id}
        value={choice}
        aria-describedby={describedBy}
        aria-required={isRequired || undefined}
        aria-invalid={(isInvalid && !isAddress) || undefined}
        onChange={(event) => chooseOption(event.target.value)}
        className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
      >
        <option value={NO_LINK_CHOICE} disabled={isRequired}>
          {isRequired ? "Choose a page…" : "No link"}
        </option>
        <LinkOptionGroups linkOptions={linkOptions} />
        <option value={ADDRESS_CHOICE}>Another address…</option>
      </select>
      {isAddress && (
        <input
          type="text"
          aria-label={`${label} address`}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        />
      )}
    </div>
  );
};

export default BlockLinkField;
