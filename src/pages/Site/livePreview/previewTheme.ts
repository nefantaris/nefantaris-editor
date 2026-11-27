import { EditorView } from "@codemirror/view";

export const livePreviewTheme = EditorView.theme({
  ".nef-link": {
    color: "var(--color-primary-ink)",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".nef-inline-code": {
    backgroundColor: "var(--color-raised)",
    borderRadius: "0.375rem",
    padding: "0.0625rem 0.25rem",
  },
  ".nef-footnote-ref": {
    fontSize: "0.75em",
    verticalAlign: "super",
    color: "var(--color-primary-ink)",
  },
  ".nef-footnote-def": {
    color: "var(--color-ink-secondary)",
    fontSize: "0.875em",
  },
  ".nef-list-mark": {
    color: "var(--color-ink-muted)",
  },
  ".nef-bullet": {
    color: "var(--color-ink-muted)",
  },
  ".nef-quote-line": {
    borderLeft: "3px solid var(--color-raised-strong)",
    paddingLeft: "0.75rem",
    color: "var(--color-ink-secondary)",
  },
  ".nef-code-line": {
    backgroundColor: "var(--color-sunken)",
    fontFamily: "var(--font-mono)",
  },
  ".nef-code-fence": {
    color: "var(--color-ink-muted)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
  },
  ".nef-frontmatter-line": {
    color: "var(--color-ink-muted)",
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
    color: "var(--color-ink-disabled)",
    letterSpacing: "0.25em",
  },
  ".nef-task-checkbox": {
    accentColor: "var(--color-primary)",
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
    borderTop: "2px solid var(--color-raised-strong)",
  },
  ".nef-directive-line": {
    backgroundColor: "var(--color-sunken)",
  },
  ".nef-directive-fence": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    width: "100%",
    padding: "0.125rem 0.5rem",
    backgroundColor: "var(--color-raised)",
    borderRadius: "0.375rem",
    cursor: "pointer",
    transitionProperty: "background-color, color",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-in-out",
  },
  ".nef-directive-fence:hover": {
    backgroundColor: "var(--color-raised-strong)",
  },
  ".nef-directive-fence-close": {
    minHeight: "0.5rem",
    backgroundColor: "transparent",
  },
  ".nef-directive-fence-close:hover": {
    backgroundColor: "var(--color-raised)",
  },
  ".nef-directive-name": {
    color: "var(--color-ink-secondary)",
    fontSize: "0.8125rem",
    fontWeight: "500",
  },
  ".nef-directive-options": {
    marginLeft: "auto",
    padding: "0 0.5rem",
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink-secondary)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.75rem",
    fontWeight: "500",
    lineHeight: "1.5rem",
    cursor: "pointer",
    transitionProperty: "background-color, color",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-in-out",
  },
  ".nef-directive-options:hover": {
    backgroundColor: "var(--color-sunken)",
    color: "var(--color-ink)",
  },
  ".nef-directive-options:focus-visible": {
    outline: "2px solid var(--color-primary-ink)",
    outlineOffset: "2px",
  },
  ".nef-directive-source": {
    fontFamily: "var(--font-mono)",
    color: "var(--color-ink-muted)",
  },
  ".nef-table-source": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875em",
    backgroundColor: "var(--color-sunken)",
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
    border: "1px solid var(--color-line)",
    padding: "0.375rem 0.75rem",
    textAlign: "left",
  },
  ".nef-table-widget th": {
    backgroundColor: "var(--color-sunken)",
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
    border: "1px dashed var(--color-line)",
    borderRadius: "0.375rem",
    color: "var(--color-ink-muted)",
    fontSize: "0.875em",
    backgroundColor: "var(--color-sunken)",
  },
});
