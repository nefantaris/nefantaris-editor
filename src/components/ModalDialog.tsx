import { useEffect, useId, useRef, type PropsWithChildren } from "react";
import { classNames } from "../utils/classNames.ts";

type ModalDialogProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
  size?: "md" | "wide";
  canDismiss?: boolean;
}>;

const ModalDialog = ({
  title,
  onClose,
  size = "md",
  canDismiss = true,
  children,
}: ModalDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    const firstControl = dialog.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    firstControl?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        if (!canDismiss) {
          event.preventDefault();
        }
      }}
      aria-labelledby={titleId}
      className={classNames(
        "bg-surface text-ink backdrop:bg-backdrop m-auto flex max-h-[calc(100vh-3rem)] w-full flex-col rounded-md p-6",
        size === "md" ? "max-w-md" : "max-w-5xl",
      )}
    >
      <h2 id={titleId} className="text-ink shrink-0 text-lg font-medium">
        {title}
      </h2>
      <div className="mt-4 flex min-h-0 flex-col gap-4 overflow-y-auto">
        {children}
      </div>
    </dialog>
  );
};

export default ModalDialog;
