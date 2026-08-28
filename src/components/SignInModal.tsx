import { useEffect, useState } from "react";
import type { SignInStart } from "../../electron/ipcContract.cts";
import ModalDialog from "./ModalDialog.tsx";

type SignInModalProps = {
  onClose: () => void;
};

type SignInPhase =
  | { kind: "starting" }
  | { kind: "unconfigured" }
  | { kind: "waiting"; userCode: string; verificationUrl: string }
  | { kind: "expired" }
  | { kind: "error" };

const primaryButtonClasses =
  "bg-brand-primary text-brand-white hover:bg-brand-primaryHover grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0";
const secondaryButtonClasses =
  "bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0";

const SignInModal = ({ onClose }: SignInModalProps) => {
  const [phase, setPhase] = useState<SignInPhase>({ kind: "starting" });
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  const applyFlowStart = (start: SignInStart) => {
    if (start.status === "unconfigured") {
      setPhase({ kind: "unconfigured" });
    } else if (start.status === "failed") {
      setPhase({ kind: "error" });
    } else {
      setPhase({
        kind: "waiting",
        userCode: start.userCode,
        verificationUrl: start.verificationUrl,
      });
    }
  };

  const retryFlow = async () => {
    setPhase({ kind: "starting" });
    setIsCodeCopied(false);
    applyFlowStart(await globalThis.nefantaris.invoke("auth:startSignIn"));
  };

  const copyCode = async (userCode: string) => {
    await navigator.clipboard.writeText(userCode);
    setIsCodeCopied(true);
  };

  useEffect(() => {
    const beginFlow = async () => {
      applyFlowStart(await globalThis.nefantaris.invoke("auth:startSignIn"));
    };
    void beginFlow();
    return () => {
      void globalThis.nefantaris.invoke("auth:cancelSignIn");
    };
  }, []);

  useEffect(() => {
    return globalThis.nefantaris.on("auth:flowChanged", (flow) => {
      switch (flow.state) {
        case "success":
          onClose();
          break;
        case "expired":
          setPhase({ kind: "expired" });
          break;
        case "error":
          setPhase({ kind: "error" });
          break;
        case "pending":
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalDialog title="Sign in to GitHub" onClose={onClose}>
      {phase.kind === "starting" && (
        <p className="text-brand-gray">Getting your sign-in code…</p>
      )}
      {phase.kind === "unconfigured" && (
        <>
          <p className="text-brand-grayDark">
            GitHub sign-in isn&rsquo;t configured in this build yet.
          </p>
          <button onClick={onClose} className={secondaryButtonClasses}>
            Close
          </button>
        </>
      )}
      {phase.kind === "waiting" && (
        <>
          <p className="text-brand-grayDark">
            Enter this code on github.com to sign in:
          </p>
          <div className="flex items-center gap-3">
            <output
              aria-label="Your sign-in code"
              className="bg-brand-background text-brand-black grow rounded-md px-4 py-3 text-center font-mono text-3xl font-semibold tracking-widest select-all"
            >
              {phase.userCode}
            </output>
            <button
              onClick={() => void copyCode(phase.userCode)}
              className="text-brand-grayDark hover:bg-brand-grayLight shrink-0 rounded-md px-3 py-2 font-medium transition-colors duration-100"
            >
              {isCodeCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <p
            aria-live="polite"
            className="text-brand-gray flex items-center gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className="border-brand-gray inline-block size-4 animate-spin rounded-full border-2 border-t-transparent"
            />
            Waiting for you to finish on github.com…
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() =>
                void globalThis.nefantaris.invoke(
                  "system:openExternal",
                  phase.verificationUrl,
                )
              }
              className={primaryButtonClasses}
            >
              Open github.com
            </button>
            <button onClick={onClose} className={secondaryButtonClasses}>
              Cancel
            </button>
          </div>
        </>
      )}
      {phase.kind === "expired" && (
        <>
          <p className="text-brand-grayDark">
            That code expired before the sign-in finished. Let&rsquo;s get you a
            fresh one.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void retryFlow()}
              className={primaryButtonClasses}
            >
              Try again
            </button>
            <button onClick={onClose} className={secondaryButtonClasses}>
              Cancel
            </button>
          </div>
        </>
      )}
      {phase.kind === "error" && (
        <>
          <p className="text-brand-grayDark">
            Something went wrong while signing you in.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void retryFlow()}
              className={primaryButtonClasses}
            >
              Try again
            </button>
            <button onClick={onClose} className={secondaryButtonClasses}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ModalDialog>
  );
};

export default SignInModal;
