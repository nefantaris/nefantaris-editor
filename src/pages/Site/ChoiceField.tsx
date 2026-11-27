import { classNames } from "../../utils/classNames.ts";

export type ChoiceFieldOption = {
  value: string;
  label: string;
  fontFamily: string | null;
};

type ChoiceFieldProps = {
  id: string;
  labelledBy: string;
  describedBy?: string;
  options: ChoiceFieldOption[];
  value: string;
  emptyLabel: string | null;
  isFontPreview: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  onChange: (value: string) => void;
};

const MOST_RADIO_CHOICES = 5;

const ChoiceField = ({
  id,
  labelledBy,
  describedBy,
  options,
  value,
  emptyLabel,
  isFontPreview,
  isRequired = false,
  isInvalid = false,
  onChange,
}: ChoiceFieldProps) => {
  const isOffered =
    value === "" || options.some((option) => option.value === value);
  const choices: ChoiceFieldOption[] = [
    ...(emptyLabel === null
      ? []
      : [{ value: "", label: emptyLabel, fontFamily: null }]),
    ...options,
    ...(isOffered
      ? []
      : [
          {
            value,
            label: `${value} (not offered by your theme)`,
            fontFamily: null,
          },
        ]),
  ];
  const isRadioGroup = isFontPreview || choices.length <= MOST_RADIO_CHOICES;
  const needsPrompt = emptyLabel === null && value === "";

  return isRadioGroup ? (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required={isRequired || undefined}
      aria-invalid={isInvalid || undefined}
      className="flex flex-wrap gap-2"
    >
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={classNames(
            "bg-surface text-ink flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors duration-100",
            choice.value === value
              ? "border-primary"
              : "border-line hover:bg-sunken",
          )}
        >
          <input
            type="radio"
            name={id}
            value={choice.value}
            checked={choice.value === value}
            onChange={() => onChange(choice.value)}
            className="accent-primary h-4 w-4"
          />
          <span
            style={
              choice.fontFamily === null
                ? undefined
                : { fontFamily: choice.fontFamily }
            }
          >
            {choice.label}
          </span>
        </label>
      ))}
    </div>
  ) : (
    <select
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required={isRequired || undefined}
      aria-invalid={isInvalid || undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
    >
      {needsPrompt && (
        <option value="" disabled>
          Choose…
        </option>
      )}
      {choices.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </select>
  );
};

export default ChoiceField;
