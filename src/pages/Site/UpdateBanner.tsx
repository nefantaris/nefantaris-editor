import { CloseIcon } from "../../components/Icons.tsx";

type UpdateBannerProps = {
  error: string | null;
  isUpdating: boolean;
  onUpdateRequested: () => void;
  onDismissed: () => void;
};

const UpdateBanner = ({
  error,
  isUpdating,
  onUpdateRequested,
  onDismissed,
}: UpdateBannerProps) => {
  return (
    <div
      role="status"
      className="border-brand-border bg-brand-background flex items-center justify-between gap-3 border-b px-4 py-2"
    >
      <p className="text-brand-grayDark text-sm">
        {error ?? "A newer version of your site is online."}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onUpdateRequested}
          disabled={isUpdating}
          className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover disabled:bg-brand-disabled rounded-md px-3 py-1 text-sm font-medium transition-colors duration-100"
        >
          {isUpdating ? "Updating…" : "Update"}
        </button>
        <button
          aria-label="Dismiss"
          onClick={onDismissed}
          className="text-brand-gray hover:text-brand-black hover:bg-brand-grayLight rounded-md p-1 transition-colors duration-100"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
