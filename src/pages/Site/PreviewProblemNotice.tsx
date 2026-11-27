import type { PreviewProblem } from "../../../electron/ipcContract.cts";

type PreviewProblemNoticeProps = {
  problem: PreviewProblem;
};

const CHILD_THEME_PREFIX = "child-theme/";

function headlineOf(problem: PreviewProblem): string {
  if (problem.file === null) {
    return "The preview shows an error.";
  }
  const file = problem.file.startsWith(CHILD_THEME_PREFIX)
    ? problem.file.slice(CHILD_THEME_PREFIX.length)
    : problem.file;
  return problem.line === null
    ? `The preview shows an error in ${file}.`
    : `The preview shows an error in ${file} on line ${String(problem.line)}.`;
}

const PreviewProblemNotice = ({ problem }: PreviewProblemNoticeProps) => (
  <div
    role="alert"
    className="border-danger bg-surface flex flex-col gap-2 rounded-md border p-4 text-sm"
  >
    <p className="text-ink font-medium">{headlineOf(problem)}</p>
    <p className="text-ink-secondary">
      Your site can&rsquo;t show until it&rsquo;s fixed. Undo your last change,
      or fix the code, and the preview comes back on its own.
    </p>
    {problem.detail !== "" && (
      <details>
        <summary className="text-ink-secondary cursor-pointer">
          Show the error
        </summary>
        <pre className="bg-sunken text-ink-secondary mt-2 max-h-40 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {problem.detail}
        </pre>
      </details>
    )}
  </div>
);

export default PreviewProblemNotice;
