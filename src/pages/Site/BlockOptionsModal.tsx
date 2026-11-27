import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type {
  BlockAttribute,
  BlockSchema,
} from "../../../electron/ipcContract.cts";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import BlockLinkField from "./BlockLinkField.tsx";
import type {
  BlockFieldValue,
  BlockFormValues,
  PairedAlt,
  WrittenBlockOptions,
} from "./blockOptionsModel.ts";
import {
  blockFieldProblems,
  examplePlaceholder,
  leafTextOf,
  leafTextProblem,
  pairedAltNames,
  pairedAltOf,
} from "./blockOptionsModel.ts";
import BlockTextField from "./BlockTextField.tsx";
import ChoiceField from "./ChoiceField.tsx";
import ImageChooser from "./ImageChooser.tsx";
import { ALT_TEXT_HELP } from "./InsertImageModal.tsx";
import {
  blockInputClasses,
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
  tagClasses,
} from "./settingsStyles.ts";
import type { LinkOptions } from "./siteSettingsModel.ts";

type BlockOptionsModalProps = {
  sitePath: string;
  schema: BlockSchema;
  mode: "insert" | "edit";
  initialValues: BlockFormValues;
  initialText: string;
  original: WrittenBlockOptions | null;
  linkOptions: LinkOptions;
  onSubmit: (values: BlockFormValues, text: string) => void;
  onClose: () => void;
};

type BlockOptionFieldProps = {
  sitePath: string;
  name: string;
  attribute: BlockAttribute;
  value: BlockFieldValue | undefined;
  problem: string | undefined;
  pairedAlt: PairedAlt | null;
  altValue: string;
  altProblem: string | undefined;
  linkOptions: LinkOptions;
  onChange: (value: BlockFieldValue) => void;
  onAltChange: (value: string) => void;
};

const LEAF_TEXT_FIELD = "[text]";

const BlockOptionField = ({
  sitePath,
  name,
  attribute,
  value,
  problem,
  pairedAlt,
  altValue,
  altProblem,
  linkOptions,
  onChange,
  onAltChange,
}: BlockOptionFieldProps) => {
  const baseId = useId();
  const altInputRef = useRef<HTMLInputElement>(null);
  const [altFocusRequest, setAltFocusRequest] = useState(0);
  const controlId = `${baseId}-control`;
  const labelId = `${baseId}-label`;
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const describedBy =
    [
      attribute.description === null ? null : descriptionId,
      problem === undefined ? null : errorId,
    ]
      .filter((id) => id !== null)
      .join(" ") || undefined;
  const isInvalid = problem !== undefined;
  const text = typeof value === "string" ? value : "";
  const placeholder =
    attribute.type === "text"
      ? examplePlaceholder(attribute.example)
      : undefined;
  const isAltShown = pairedAlt !== null && (text !== "" || altValue !== "");
  const isLabelForControl =
    attribute.type === "text" ||
    attribute.type === "url" ||
    attribute.type === "boolean";
  const labelClasses = "text-ink-secondary text-sm font-medium";

  const changeImage = (image: string) => {
    onChange(image);
    if (image === "") {
      onAltChange("");
    } else if (pairedAlt !== null) {
      setAltFocusRequest((count) => count + 1);
    }
  };

  useEffect(() => {
    if (altFocusRequest > 0) {
      altInputRef.current?.focus();
    }
  }, [altFocusRequest]);

  return (
    <div
      data-field={name}
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        {attribute.type === "boolean" && (
          <input
            id={controlId}
            type="checkbox"
            checked={value === true}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.checked)}
            className="accent-primary h-4 w-4"
          />
        )}
        {isLabelForControl ? (
          <label id={labelId} htmlFor={controlId} className={labelClasses}>
            {attribute.label}
          </label>
        ) : (
          <span id={labelId} className={labelClasses}>
            {attribute.label}
          </span>
        )}
        {attribute.required && <span className={tagClasses}>Required</span>}
      </div>
      {attribute.description !== null && (
        <p id={descriptionId} className="text-ink-muted text-xs">
          {attribute.description}
        </p>
      )}
      {attribute.type === "text" &&
        (attribute.multiline ? (
          <textarea
            id={controlId}
            value={text}
            rows={3}
            placeholder={placeholder}
            aria-required={attribute.required || undefined}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            className={classNames(
              blockInputClasses,
              isInvalid && "ring-danger ring-1",
            )}
          />
        ) : (
          <input
            id={controlId}
            type="text"
            value={text}
            placeholder={placeholder}
            aria-required={attribute.required || undefined}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            className={classNames(
              blockInputClasses,
              isInvalid && "ring-danger ring-1",
            )}
          />
        ))}
      {attribute.type === "select" && (
        <ChoiceField
          id={controlId}
          labelledBy={labelId}
          describedBy={describedBy}
          options={attribute.options.map((option) => ({
            ...option,
            fontFamily: null,
          }))}
          value={text}
          emptyLabel={
            attribute.required || attribute.default !== null ? null : "None"
          }
          isFontPreview={false}
          isRequired={attribute.required}
          isInvalid={isInvalid}
          onChange={onChange}
        />
      )}
      {attribute.type === "url" && (
        <BlockLinkField
          id={controlId}
          label={attribute.label}
          describedBy={describedBy}
          value={text}
          linkOptions={linkOptions}
          placeholder={examplePlaceholder(attribute.example)}
          isRequired={attribute.required}
          isInvalid={isInvalid}
          onChange={onChange}
        />
      )}
      {attribute.type === "image" && (
        <ImageChooser
          sitePath={sitePath}
          image={text}
          noun={attribute.label.toLowerCase()}
          emptyText="No image chosen"
          pickerTitle={`Choose ${attribute.label.toLowerCase()}`}
          onImageChanged={changeImage}
        />
      )}
      {problem !== undefined && (
        <p id={errorId} className="text-danger text-xs">
          {problem}
        </p>
      )}
      {isAltShown && (
        <BlockTextField
          fieldName={pairedAlt.name}
          label={pairedAlt.attribute.label}
          description={pairedAlt.attribute.description ?? ALT_TEXT_HELP}
          isRequired={pairedAlt.attribute.required}
          value={altValue}
          placeholder={examplePlaceholder(pairedAlt.attribute.example)}
          problem={altProblem}
          inputRef={altInputRef}
          onChange={onAltChange}
        />
      )}
    </div>
  );
};

const BlockOptionsModal = ({
  sitePath,
  schema,
  mode,
  initialValues,
  initialText,
  original,
  linkOptions,
  onSubmit,
  onClose,
}: BlockOptionsModalProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(initialValues);
  const [text, setText] = useState(initialText);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const leafText = leafTextOf(schema);
  const altNames = pairedAltNames(schema);
  const problems = blockFieldProblems(schema, values, original);
  const textProblem = leafTextProblem(schema, text);
  const shownProblems: Record<string, string> = hasTriedSubmit ? problems : {};
  const shownTextProblem = hasTriedSubmit ? textProblem : null;
  const title =
    mode === "insert" ? `Add ${schema.label}` : `${schema.label} options`;

  const changeValue = (name: string, value: BlockFieldValue) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [firstProblem] = [
      ...(textProblem === null ? [] : [LEAF_TEXT_FIELD]),
      ...Object.keys(problems),
    ];
    if (firstProblem === undefined) {
      onSubmit(values, text);
      return;
    }
    setHasTriedSubmit(true);
    formRef.current
      ?.querySelector<HTMLElement>(
        `[data-field="${CSS.escape(firstProblem)}"] :is(input, select, textarea, button)`,
      )
      ?.focus();
  };

  return (
    <ModalDialog title={title} onClose={onClose}>
      {schema.description !== null && (
        <p className="text-ink-muted text-sm">{schema.description}</p>
      )}
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        {leafText !== null && (
          <BlockTextField
            fieldName={LEAF_TEXT_FIELD}
            label={leafText.label}
            description={leafText.description}
            isRequired={leafText.required}
            value={text}
            problem={shownTextProblem ?? undefined}
            onChange={setText}
          />
        )}
        {Object.entries(schema.attributes)
          .filter(([name]) => !altNames.has(name))
          .map(([name, attribute]) => {
            const pairedAlt = pairedAltOf(schema, attribute);
            const altValue =
              pairedAlt === null ? undefined : values[pairedAlt.name];
            return (
              <BlockOptionField
                key={name}
                sitePath={sitePath}
                name={name}
                attribute={attribute}
                value={values[name]}
                problem={shownProblems[name]}
                pairedAlt={pairedAlt}
                altValue={typeof altValue === "string" ? altValue : ""}
                altProblem={
                  pairedAlt === null ? undefined : shownProblems[pairedAlt.name]
                }
                linkOptions={linkOptions}
                onChange={(value) => changeValue(name, value)}
                onAltChange={(value) => {
                  if (pairedAlt !== null) {
                    changeValue(pairedAlt.name, value);
                  }
                }}
              />
            );
          })}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className={modalPrimaryButtonClasses}>
            {mode === "insert" ? "Insert" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={modalSecondaryButtonClasses}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export default BlockOptionsModal;
