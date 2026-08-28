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
