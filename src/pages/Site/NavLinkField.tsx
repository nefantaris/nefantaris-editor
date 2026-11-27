import { useId, useState } from "react";
import { classNames } from "../../utils/classNames.ts";
import AutosaveTextField from "./AutosaveTextField.tsx";
import LinkOptionGroups, { ROUTE_CHOICE_PREFIX } from "./LinkOptionGroups.tsx";
import type { LinkOptions } from "./siteSettingsModel.ts";
import { linkAddressProblem } from "./siteSettingsModel.ts";

type NavLinkFieldProps = {
  href: string;
  linkOptions: LinkOptions;
  onCommit: (href: string) => void;
  className?: string;
};

const ADDRESS_CHOICE = "address";

const NavLinkField = ({
  href,
  linkOptions,
  onCommit,
  className,
}: NavLinkFieldProps) => {
  const selectId = useId();
  const [isTypingAddress, setIsTypingAddress] = useState(false);

  const knownRoutes = [...linkOptions.pages, ...linkOptions.posts].map(
    (option) => option.route,
  );
  const isAddress = isTypingAddress || !knownRoutes.includes(href);
  const choice = isAddress ? ADDRESS_CHOICE : `${ROUTE_CHOICE_PREFIX}${href}`;

  const chooseOption = (value: string) => {
    if (value === ADDRESS_CHOICE) {
      setIsTypingAddress(true);
      return;
    }
    setIsTypingAddress(false);
    const route = value.slice(ROUTE_CHOICE_PREFIX.length);
    if (route !== href) {
      onCommit(route);
    }
  };

  return (
    <div className={classNames("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor={selectId}
          className="text-ink-secondary text-xs font-medium"
        >
          Links to
        </label>
        <select
          id={selectId}
          value={choice}
          onChange={(event) => chooseOption(event.target.value)}
          className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
        >
          <LinkOptionGroups linkOptions={linkOptions} />
          <option value={ADDRESS_CHOICE}>Another address…</option>
        </select>
      </div>
      {isAddress && (
        <AutosaveTextField
          label="Address"
          value={href}
          validate={linkAddressProblem}
          placeholder="https://example.com"
          onCommit={(value) => onCommit(value.trim())}
        />
      )}
    </div>
  );
};

export default NavLinkField;
