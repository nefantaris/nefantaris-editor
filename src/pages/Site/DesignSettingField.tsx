import type {
  JsonValue,
  ThemeBooleanSetting,
  ThemeImageSetting,
  ThemeSelectSetting,
  ThemeSettingDefinition,
  ThemeSettingValue,
  ThemeTextSetting,
} from "../../../electron/ipcContract.cts";
import AutosaveTextField from "./AutosaveTextField.tsx";
import ChoiceField from "./ChoiceField.tsx";
import ColorSettingField from "./ColorSettingField.tsx";
import {
  booleanInForce,
  imageInForce,
  isFontSetting,
  scalarChoice,
  settingStatus,
  textInForce,
} from "./designModel.ts";
import ImageChooser from "./ImageChooser.tsx";
import SettingFieldFrame, { type SettingOwner } from "./SettingFieldFrame.tsx";

type SettingChange = (value: JsonValue | undefined) => void;

type FieldProps<Definition extends ThemeSettingDefinition> = {
  name: string;
  definition: Definition;
  stored: JsonValue | undefined;
  reported: ThemeSettingValue | undefined;
  owner: SettingOwner;
  onChange: SettingChange;
};

type DesignSettingFieldProps = FieldProps<ThemeSettingDefinition> & {
  sitePath: string;
  hasDarkLook: boolean;
};

const SelectSettingField = ({
  name,
  definition,
  stored,
  reported,
  owner,
  onChange,
}: FieldProps<ThemeSelectSetting>) => {
  const isFont = isFontSetting(definition);
  return (
    <SettingFieldFrame
      name={name}
      label={definition.label}
      description={definition.description}
      status={settingStatus(definition, stored)}
      owner={owner}
      isLabelForControl={false}
      onReset={() => onChange(undefined)}
      renderControl={(ids) => (
        <ChoiceField
          id={ids.controlId}
          labelledBy={ids.labelId}
          describedBy={ids.describedBy}
          options={definition.options.map((option) => ({
            value: option.value,
            label: option.label,
            fontFamily: isFont ? (option.css ?? option.value) : null,
          }))}
          value={textInForce(definition, stored, reported)}
          emptyLabel={null}
          isFontPreview={isFont}
          onChange={(value) => onChange(scalarChoice(definition, value))}
        />
      )}
    />
  );
};

const BooleanSettingField = ({
  name,
  definition,
  stored,
  reported,
  owner,
  onChange,
}: FieldProps<ThemeBooleanSetting>) => (
  <SettingFieldFrame
    name={name}
    label={definition.label}
    description={definition.description}
    status={settingStatus(definition, stored)}
    owner={owner}
    isLabelForControl
    onReset={() => onChange(undefined)}
    renderLeading={(ids) => (
      <input
        id={ids.controlId}
        type="checkbox"
        checked={booleanInForce(definition, stored, reported)}
        aria-describedby={ids.describedBy}
        onChange={(event) =>
          onChange(scalarChoice(definition, event.target.checked))
        }
        className="accent-primary h-4 w-4"
      />
    )}
    renderControl={() => null}
  />
);

const TextSettingField = ({
  name,
  definition,
  stored,
  reported,
  owner,
  onChange,
}: FieldProps<ThemeTextSetting>) => (
  <SettingFieldFrame
    name={name}
    label={definition.label}
    description={definition.description}
    status={settingStatus(definition, stored)}
    owner={owner}
    isLabelForControl={false}
    onReset={() => onChange(undefined)}
    renderControl={(ids) => (
      <AutosaveTextField
        label={definition.label}
        labelledBy={ids.labelId}
        describedBy={ids.describedBy}
        value={textInForce(definition, stored, reported)}
        isMultiline={definition.multiline}
        onCommit={(value) => onChange(scalarChoice(definition, value))}
      />
    )}
  />
);

const ImageSettingField = ({
  sitePath,
  name,
  definition,
  stored,
  reported,
  owner,
  onChange,
}: FieldProps<ThemeImageSetting> & { sitePath: string }) => (
  <SettingFieldFrame
    name={name}
    label={definition.label}
    description={definition.description}
    status={settingStatus(definition, stored)}
    owner={owner}
    isLabelForControl={false}
    onReset={() => onChange(undefined)}
    renderControl={() => (
      <ImageChooser
        sitePath={sitePath}
        image={imageInForce(definition, stored, reported) ?? ""}
        noun={definition.label.toLowerCase()}
        emptyText="No image chosen"
        pickerTitle={`Choose ${definition.label.toLowerCase()}`}
        fileInputTestId={`setting-image-file-${name}`}
        onImageChanged={(image) =>
          onChange(scalarChoice(definition, image === "" ? null : image))
        }
      />
    )}
  />
);

const DesignSettingField = ({
  sitePath,
  hasDarkLook,
  definition,
  ...field
}: DesignSettingFieldProps) => (
  <>
    {definition.type === "color" && (
      <ColorSettingField
        {...field}
        definition={definition}
        hasDarkLook={hasDarkLook}
      />
    )}
    {definition.type === "select" && (
      <SelectSettingField {...field} definition={definition} />
    )}
    {definition.type === "boolean" && (
      <BooleanSettingField {...field} definition={definition} />
    )}
    {definition.type === "text" && (
      <TextSettingField {...field} definition={definition} />
    )}
    {definition.type === "image" && (
      <ImageSettingField
        {...field}
        sitePath={sitePath}
        definition={definition}
      />
    )}
  </>
);

export default DesignSettingField;
