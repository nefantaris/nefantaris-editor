import { useId, type PropsWithChildren } from "react";

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
}>;

const SettingsSection = ({
  title,
  description,
  children,
}: SettingsSectionProps) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-ink text-base font-medium">
          {title}
        </h2>
        {description !== undefined && (
          <p className="text-ink-muted text-sm">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
};

export default SettingsSection;
