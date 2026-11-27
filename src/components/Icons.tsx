import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

export const PlusIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export const PencilIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m11.1 2.4 2.5 2.5L5.5 13 2.6 13.4 3 10.5l8.1-8.1Z" />
  </svg>
);

export const PanelRightIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M9 3v10" />
  </svg>
);

export const ReloadIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" />
  </svg>
);

export const ExternalLinkIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M6.5 3.5H3.5v9h9v-3M9.5 2.5h4v4M13 3 7.5 8.5" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m3 8.5 3.5 3.5L13 4.5" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2.5 4.5h11M6.5 2.5h3M5.5 4.5v9h5v-9M6.8 7v4M9.2 7v4" />
  </svg>
);

export const ArrowUpIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
  </svg>
);

export const ArrowDownIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
  </svg>
);

export const SlidersIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2.5 4.5h3M8.5 4.5h5M2.5 11.5h7M12.5 11.5h1" />
    <circle cx="7" cy="4.5" r="1.5" />
    <circle cx="11" cy="11.5" r="1.5" />
  </svg>
);

export const PaletteIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 2.5a5.5 5.5 0 1 0 0 11c.9 0 1.4-.6 1.4-1.3 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.7.6-1.2 1.3-1.2h1.4a2.2 2.2 0 0 0 2.2-2.2C13.5 4.6 11 2.5 8 2.5Z" />
    <circle cx="5.25" cy="7.25" r=".6" />
    <circle cx="7.5" cy="5" r=".6" />
    <circle cx="10.5" cy="5.75" r=".6" />
  </svg>
);

export const BrushIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M13.5 2.5 7.75 8.25" />
    <path d="M9.25 6.75 7 4.5" />
    <path d="M7.25 8.75c-.9-.9-2.4-.9-3.3 0-.9.9-.6 2.2-1.45 3.05-.25.25-.5.4-.75.45 1.55 1 3.95 1 5.5-.55.9-.9.9-2.05 0-2.95Z" />
  </svg>
);

export const FilesIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M4.5 2.5h4.25l3 3v7a1 1 0 0 1-1 1h-6.25a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    <path d="M8.5 2.5v3.25h3.25M5.75 8.5h4.5M5.75 11h3" />
  </svg>
);

export const BlocksIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2.5 5.5h4v4h4v4h-8v-8ZM2.5 9.5h4v4" />
    <rect x="9.5" y="2.5" width="4" height="4" rx=".5" />
  </svg>
);

const StrokeIcon = ({
  className,
  children,
}: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {children}
  </svg>
);

export const BoldIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path
      d="M4.5 2.75h4.25a2.6 2.6 0 0 1 0 5.2H4.5ZM4.5 7.95h5a2.65 2.65 0 0 1 0 5.3h-5Z"
      strokeWidth="2"
    />
  </StrokeIcon>
);

export const ItalicIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M6.5 2.75h5M4.5 13.25h5M9.75 2.75 6.25 13.25" />
  </StrokeIcon>
);

export const StrikethroughIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M2.5 8h11M11 4.25c-.5-1-1.6-1.5-3-1.5-1.9 0-3.25.9-3.25 2.4 0 .9.5 1.5 1.4 1.95M5 11.5c.5 1.1 1.7 1.75 3.2 1.75 2 0 3.3-1 3.3-2.5 0-.4-.1-.75-.3-1.05" />
  </StrokeIcon>
);

export const InlineCodeIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
  </StrokeIcon>
);

export const LinkIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.6.6M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.6-.6" />
  </StrokeIcon>
);

export const BulletListIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M6 4h7.5M6 8h7.5M6 12h7.5" />
    <circle cx="2.75" cy="4" r=".5" />
    <circle cx="2.75" cy="8" r=".5" />
    <circle cx="2.75" cy="12" r=".5" />
  </StrokeIcon>
);

export const NumberedListIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.25 2.75h1v3M2 5.75h2.25M2 10.25c.2-.4.6-.6 1-.6.55 0 1 .4 1 .9 0 .8-2 1.5-2 2.2h2" />
  </StrokeIcon>
);

export const ChecklistIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M7.5 4.5h6M7.5 11.5h6M2.25 4.25l1.25 1.25 2-2.25" />
    <rect x="2.25" y="9.5" width="3.5" height="3.5" rx=".5" />
  </StrokeIcon>
);

export const QuoteIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M3 3.5v9M6.5 5h7M6.5 8h7M6.5 11h4.5" />
  </StrokeIcon>
);

export const CodeBlockIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.25" />
    <path d="M6.25 6.5 4.75 8l1.5 1.5M9.75 6.5 11.25 8l-1.5 1.5" />
  </StrokeIcon>
);

export const DividerIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M4.5 4.5h7M4.5 11.5h7" strokeOpacity=".45" />
    <path d="M2 8h12" />
  </StrokeIcon>
);

export const TableIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.25" />
    <path d="M2 6.25h12M2 9.75h12M6 6.25v7.25M10 6.25v7.25" />
  </StrokeIcon>
);

export const ImageIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.25" />
    <circle cx="5.75" cy="6" r="1.1" />
    <path d="m2.5 12 3.75-3.75 2.5 2.5 1.75-1.75 3.5 3.5" />
  </StrokeIcon>
);

export const GalleryIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <rect x="2" y="2" width="5" height="5" rx=".75" />
    <rect x="9" y="2" width="5" height="5" rx=".75" />
    <rect x="2" y="9" width="5" height="5" rx=".75" />
    <rect x="9" y="9" width="5" height="5" rx=".75" />
  </StrokeIcon>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M4 6.25 8 10.25l4-4" />
  </StrokeIcon>
);

export const PointerIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="m3 2.75 9.5 4-4 1.25-1.25 4-4.25-9.25ZM8.5 8l4 4" />
  </StrokeIcon>
);

export const CodeIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13" />
  </StrokeIcon>
);

export const ArrowLeftIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5" />
  </StrokeIcon>
);

export const FolderIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M2 4.25c0-.7.55-1.25 1.25-1.25h2.9l1.5 1.75h5.1c.7 0 1.25.55 1.25 1.25v6.25c0 .7-.55 1.25-1.25 1.25H3.25C2.55 13.5 2 12.95 2 12.25Z" />
  </StrokeIcon>
);

export const CloudDownloadIcon = ({ className }: IconProps) => (
  <StrokeIcon className={className}>
    <path d="M4.75 11.5H4.5a2.75 2.75 0 0 1-.4-5.47 4 4 0 0 1 7.8 0 2.75 2.75 0 0 1-.4 5.47h-.25M8 7.5v6M6 11.5l2 2 2-2" />
  </StrokeIcon>
);

export const SpiderwebMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
    <rect width="512" height="512" rx="96" className="fill-primary" />
    <g
      fill="none"
      strokeWidth="22"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-on-primary"
    >
      <path d="M256 256V42M256 256 407.32 104.68M256 256H470M256 256 407.32 407.32M256 256V470M256 256 104.68 407.32M256 256H42M256 256 104.68 104.68" />
      <path d="M256 42Q319.88 101.79 407.32 104.68 410.21 192.12 470 256 410.21 319.88 407.32 407.32 319.88 410.21 256 470 192.12 410.21 104.68 407.32 101.79 319.88 42 256 101.79 192.12 104.68 104.68 192.12 101.79 256 42Z" />
      <path d="M256 118Q294.02 164.2 353.58 158.42 347.8 217.98 394 256 347.8 294.02 353.58 353.58 294.02 347.8 256 394 217.98 347.8 158.42 353.58 164.2 294.02 118 256 164.2 217.98 158.42 158.42 217.98 164.2 256 118Z" />
      <path d="M256 178Q274.51 211.32 311.15 200.85 300.68 237.49 334 256 300.68 274.51 311.15 311.15 274.51 300.68 256 334 237.49 300.68 200.85 311.15 211.32 274.51 178 256 211.32 237.49 200.85 200.85 237.49 211.32 256 178Z" />
    </g>
  </svg>
);
