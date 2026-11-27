import type { PluginDetail } from "../../../electron/ipcContract.cts";
import StatusDot from "../../components/StatusDot.tsx";
import { blocksSentence, headTagSentence } from "./addOnsModel.ts";

type AddOnProvidesProps = {
  title: string;
  detail: PluginDetail;
  blockLabels: string[];
};

const AddOnProvides = ({ title, detail, blockLabels }: AddOnProvidesProps) => {
  const hasAnything =
    blockLabels.length > 0 ||
    detail.functions.length > 0 ||
    detail.head.length > 0;

  return hasAnything ? (
    <ul
      aria-label={`What ${title} adds`}
      className="text-ink-secondary flex flex-col gap-1.5 text-sm"
    >
      {blockLabels.length > 0 && <li>{blocksSentence(blockLabels)}</li>}
      {detail.functions.map((route) => (
        <li key={route}>
          Receives requests at{" "}
          <code className="bg-raised rounded-md px-1 py-0.5 text-xs break-all">
            {route}
          </code>
        </li>
      ))}
      {detail.head.map((tag, index) => (
        <li
          key={`${index}:${tag.tag}`}
          className="flex flex-wrap items-start justify-between gap-2"
        >
          <span>{headTagSentence(tag, detail.settings)}</span>
          <span className="text-ink-secondary flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <StatusDot tone={tag.active ? "positive" : "quiet"} />
            {tag.active ? "On" : "Off"}
          </span>
        </li>
      ))}
    </ul>
  ) : null;
};

export default AddOnProvides;
