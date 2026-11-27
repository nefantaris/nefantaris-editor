import { useId } from "react";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type AddOnRemoveButtonProps = {
  title: string;
  isRequiredByTheme: boolean;
  isDisabled: boolean;
  onRemoveRequested: () => void;
};

const AddOnRemoveButton = ({
  title,
  isRequiredByTheme,
  isDisabled,
  onRemoveRequested,
}: AddOnRemoveButtonProps) => {
  const noteId = useId();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-label={`Remove ${title}`}
        aria-describedby={isRequiredByTheme ? noteId : undefined}
        disabled={isDisabled || isRequiredByTheme}
        onClick={onRemoveRequested}
        className={secondaryButtonClasses}
      >
        Remove
      </button>
      {isRequiredByTheme && (
        <p id={noteId} className="text-ink-muted text-sm">
          Your theme needs this add-on, so it stays while your site uses this
          theme.
        </p>
      )}
    </div>
  );
};

export default AddOnRemoveButton;
