import ModalDialog from "../../components/ModalDialog.tsx";
import {
  modalDangerButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

export type ResetKind = "reset" | "useTheme";

type ResetComponentModalProps = {
  kind: ResetKind;
  label: string;
  onConfirm: () => void;
  onClose: () => void;
};

const ResetComponentModal = ({
  kind,
  label,
  onConfirm,
  onClose,
}: ResetComponentModalProps) => (
  <ModalDialog
    title={
      kind === "reset"
        ? `Reset ${label} to your theme’s version?`
        : `Use the theme’s new version of ${label}?`
    }
    onClose={onClose}
  >
    <p className="text-ink-secondary text-sm">
      Your changes to this file are removed and your site uses the theme&rsquo;s
      version again. You can customize it again at any time.
    </p>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onConfirm}
        className={modalDangerButtonClasses}
      >
        {kind === "reset" ? "Reset to theme" : "Use the theme’s version"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className={modalSecondaryButtonClasses}
      >
        Cancel
      </button>
    </div>
  </ModalDialog>
);

export default ResetComponentModal;
