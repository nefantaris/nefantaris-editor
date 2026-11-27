import type { LinkOptions } from "./siteSettingsModel.ts";

export const ROUTE_CHOICE_PREFIX = "route:";

type LinkOptionGroupsProps = {
  linkOptions: LinkOptions;
};

const LinkOptionGroups = ({ linkOptions }: LinkOptionGroupsProps) => (
  <>
    {!!linkOptions.pages.length && (
      <optgroup label="Pages">
        {linkOptions.pages.map((option) => (
          <option
            key={option.key}
            value={`${ROUTE_CHOICE_PREFIX}${option.route}`}
          >
            {`${option.label} (${option.route})`}
          </option>
        ))}
      </optgroup>
    )}
    {!!linkOptions.posts.length && (
      <optgroup label="Posts">
        {linkOptions.posts.map((option) => (
          <option
            key={option.key}
            value={`${ROUTE_CHOICE_PREFIX}${option.route}`}
          >
            {`${option.label} (${option.route})`}
          </option>
        ))}
      </optgroup>
    )}
  </>
);

export default LinkOptionGroups;
