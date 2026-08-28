import { useEffect, useRef, type PropsWithChildren } from "react";
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
      aria-labelledby="modal-title"
      className={classNames(
        "bg-brand-white backdrop:bg-brand-black/50 m-auto flex max-h-[calc(100vh-3rem)] w-full flex-col rounded-md p-6",
        size === "md" ? "max-w-md" : "max-w-5xl",
      )}
    >
      <h2
        id="modal-title"
        className="text-brand-black shrink-0 text-lg font-semibold"
      >
        {title}
      </h2>
      <div className="mt-4 flex min-h-0 flex-col gap-4 overflow-y-auto">
        {children}
      </div>
    </dialog>
  );
};

export default ModalDialog;
