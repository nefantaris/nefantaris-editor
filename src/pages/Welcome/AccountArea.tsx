import type { AuthStatus } from "../../../electron/ipcContract.cts";

type AccountAreaProps = {
  status: AuthStatus | null;
  onSignInRequested: () => void;
};

const AccountArea = ({ status, onSignInRequested }: AccountAreaProps) => {
  return (
    <footer
      aria-label="Account"
      className="border-brand-border flex min-h-12 items-center justify-between gap-3 border-t pt-4"
    >
      {status?.state === "unconfigured" && (
        <p className="text-brand-gray text-sm">
          GitHub sign-in isn&rsquo;t configured in this build yet.
        </p>
      )}
      {status?.state === "signed-out" && (
        <>
          <p className="text-brand-gray text-sm">
            Sign in to connect and publish your sites.
          </p>
          <button
            onClick={onSignInRequested}
            className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover shrink-0 rounded-md px-4 py-2 font-medium transition-colors duration-100"
          >
            Sign in to GitHub
          </button>
        </>
      )}
      {status?.state === "signed-in" && (
        <>
          <div className="min-w-0">
            <p className="text-brand-black truncate text-sm font-medium">
              Signed in as {status.account.name ?? status.account.login}
            </p>
            {status.isSessionOnly && (
              <p className="text-brand-gray text-sm">
                You&rsquo;ll need to sign in again next time you open the app.
              </p>
            )}
          </div>
          <button
            onClick={() => void globalThis.nefantaris.invoke("auth:signOut")}
            className="text-brand-grayDark hover:bg-brand-grayLight shrink-0 rounded-md px-3 py-2 font-medium transition-colors duration-100"
          >
            Sign out
          </button>
        </>
      )}
    </footer>
  );
};

export default AccountArea;
