import { EditorView } from "@codemirror/view";

export const livePreviewTheme = EditorView.theme({
  ".nef-link": {
    color: "var(--color-brand-primary)",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".nef-inline-code": {
    backgroundColor: "var(--color-brand-grayLight)",
    borderRadius: "0.375rem",
    padding: "0.0625rem 0.25rem",
  },
  ".nef-footnote-ref": {
    fontSize: "0.75em",
    verticalAlign: "super",
    color: "var(--color-brand-primary)",
  },
  ".nef-footnote-def": {
    color: "var(--color-brand-grayDark)",
    fontSize: "0.875em",
  },
  ".nef-list-mark": {
    color: "var(--color-brand-gray)",
  },
  ".nef-bullet": {
    color: "var(--color-brand-gray)",
  },
  ".nef-quote-line": {
    borderLeft: "3px solid var(--color-brand-grayLight)",
    paddingLeft: "0.75rem",
    color: "var(--color-brand-grayDark)",
  },
  ".nef-code-line": {
    backgroundColor: "var(--color-brand-background)",
    fontFamily: "var(--font-mono)",
  },
  ".nef-code-fence": {
    color: "var(--color-brand-gray)",
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  ".nef-frontmatter-line": {
    color: "var(--color-brand-gray)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8125em",
  },
  ".nef-frontmatter-line span": {
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: "400",
    fontStyle: "normal",
  },
  ".nef-frontmatter-fence": {
    color: "var(--color-brand-border)",
    letterSpacing: "0.25em",
  },
  ".nef-task-checkbox": {
    accentColor: "var(--color-brand-primary)",
    width: "0.9375rem",
    height: "0.9375rem",
    marginRight: "0.25rem",
    verticalAlign: "middle",
    cursor: "pointer",
  },
  ".nef-hr": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop: "2px solid var(--color-brand-grayLight)",
  },
  ".nef-directive-line": {
    backgroundColor: "var(--color-brand-background)",
  },
  ".nef-directive-fence": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    width: "100%",
    padding: "0.125rem 0.5rem",
    backgroundColor: "var(--color-brand-grayLight)",
    borderRadius: "0.375rem",
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-in-out",
  },
  ".nef-directive-fence:hover": {
    backgroundColor: "var(--color-brand-border)",
  },
  ".nef-directive-fence-close": {
    minHeight: "0.625rem",
  },
  ".nef-directive-name": {
    color: "var(--color-brand-grayDark)",
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  ".nef-directive-source": {
    fontFamily: "var(--font-mono)",
    color: "var(--color-brand-gray)",
  },
  ".nef-table-source": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875em",
    backgroundColor: "var(--color-brand-background)",
  },
  ".nef-table-source span": {
    fontFamily: "inherit",
  },
  ".nef-table-widget": {
    padding: "0.25rem 0",
    cursor: "pointer",
  },
  ".nef-table-widget table": {
    borderCollapse: "collapse",
  },
  ".nef-table-widget th, .nef-table-widget td": {
    border: "1px solid var(--color-brand-grayLight)",
    padding: "0.375rem 0.75rem",
    textAlign: "left",
  },
  ".nef-table-widget th": {
    backgroundColor: "var(--color-brand-background)",
    fontWeight: "600",
  },
  '.nef-table-widget [data-align="center"]': {
    textAlign: "center",
  },
  '.nef-table-widget [data-align="right"]': {
    textAlign: "right",
  },
  ".nef-image-widget": {
    padding: "0.25rem 0",
  },
  ".nef-image-widget img": {
    maxWidth: "100%",
    maxHeight: "20rem",
    borderRadius: "0.375rem",
    cursor: "pointer",
  },
  ".nef-image-placeholder": {
    display: "inline-block",
    padding: "0.25rem 0.75rem",
    border: "1px dashed var(--color-brand-border)",
    borderRadius: "0.375rem",
    color: "var(--color-brand-gray)",
    fontSize: "0.875em",
    backgroundColor: "var(--color-brand-background)",
  },
});
