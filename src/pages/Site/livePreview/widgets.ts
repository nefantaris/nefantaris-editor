import type { EditorView } from "@codemirror/view";
import { WidgetType } from "@codemirror/view";

function moveCursorToWidget(view: EditorView, dom: HTMLElement): void {
  view.dispatch({ selection: { anchor: view.posAtDOM(dom) } });
  view.focus();
}

export class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly isChecked: boolean) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.isChecked === this.isChecked;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "nef-task-checkbox";
    input.checked = this.isChecked;
    input.setAttribute("aria-label", "Task");
    input.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    input.addEventListener("click", (event) => {
      event.preventDefault();
      const markerFrom = view.posAtDOM(input);
      const marker = view.state.sliceDoc(markerFrom, markerFrom + 3);
      if (!/^\[[ xX]\]$/.test(marker)) {
        return;
      }
      const toggled = marker === "[ ]" ? "[x]" : "[ ]";
      view.dispatch({
        changes: { from: markerFrom, to: markerFrom + 3, insert: toggled },
        userEvent: "input",
      });
    });
    return input;
  }
}

export class BulletWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "nef-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

export class HorizontalRuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const rule = document.createElement("span");
    rule.className = "nef-hr";
    return rule;
  }
}

export class CodeFenceInfoWidget extends WidgetType {
  constructor(private readonly language: string) {
    super();
  }

  eq(other: CodeFenceInfoWidget): boolean {
    return other.language === this.language;
  }

  toDOM(): HTMLElement {
    const label = document.createElement("span");
    label.className = "nef-code-fence";
    label.textContent = this.language;
    return label;
  }
}

export type DirectiveFenceEdge = "open" | "close" | "leaf";

export type DirectiveFenceSpec = {
  name: string;
  label: string;
  edge: DirectiveFenceEdge;
  onOptionsRequested: ((lineFrom: number) => void) | null;
};

function buildOptionsButton(
  label: string,
  onPressed: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nef-directive-options";
  button.textContent = "Options";
  button.setAttribute("aria-label", `${label} options`);
  button.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onPressed();
  });
  return button;
}

export class DirectiveFenceWidget extends WidgetType {
  constructor(private readonly spec: DirectiveFenceSpec) {
    super();
  }

  eq(other: DirectiveFenceWidget): boolean {
    return (
      other.spec.name === this.spec.name &&
      other.spec.label === this.spec.label &&
      other.spec.edge === this.spec.edge &&
      other.spec.onOptionsRequested === this.spec.onOptionsRequested
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const { name, label, edge, onOptionsRequested } = this.spec;
    const bar = document.createElement("span");
    bar.className = `nef-directive-fence nef-directive-fence-${edge}`;
    bar.dataset.directive = name;
    if (edge !== "close") {
      const labelElement = document.createElement("span");
      labelElement.className = "nef-directive-name";
      labelElement.textContent = label;
      bar.append(labelElement);
    }
    if (onOptionsRequested !== null) {
      bar.append(
        buildOptionsButton(label, () => onOptionsRequested(view.posAtDOM(bar))),
      );
    }
    bar.addEventListener("mousedown", (event) => {
      event.preventDefault();
      moveCursorToWidget(view, bar);
    });
    return bar;
  }
}

function buildImagePlaceholder(altText: string): HTMLElement {
  const placeholder = document.createElement("span");
  placeholder.className = "nef-image-placeholder";
  placeholder.textContent =
    altText === "" ? "Image unavailable" : `Image unavailable: ${altText}`;
  return placeholder;
}

export class ImagePreviewWidget extends WidgetType {
  constructor(
    private readonly src: string | null,
    private readonly altText: string,
  ) {
    super();
  }

  eq(other: ImagePreviewWidget): boolean {
    return other.src === this.src && other.altText === this.altText;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "nef-image-widget";
    if (this.src === null) {
      container.append(buildImagePlaceholder(this.altText));
      return container;
    }
    const image = document.createElement("img");
    image.className = "nef-image";
    image.alt = this.altText;
    image.src = this.src;
    image.addEventListener("error", () => {
      image.replaceWith(buildImagePlaceholder(this.altText));
    });
    image.addEventListener("mousedown", (event) => {
      event.preventDefault();
      moveCursorToWidget(view, container);
    });
    container.append(image);
    return container;
  }
}

export type TableColumnAlign = "left" | "center" | "right" | null;

export type TableWidgetModel = {
  header: string[];
  aligns: TableColumnAlign[];
  rows: string[][];
};

function fillTableRow(
  row: HTMLTableRowElement,
  cells: string[],
  aligns: TableColumnAlign[],
  cellTag: "th" | "td",
): void {
  for (const [index, text] of cells.entries()) {
    const cell = document.createElement(cellTag);
    cell.textContent = text;
    if (cellTag === "th") {
      cell.setAttribute("scope", "col");
    }
    const align = aligns[index];
    if (align) {
      cell.dataset.align = align;
    }
    row.append(cell);
  }
}

export class TableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly model: TableWidgetModel,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "nef-table-widget";
    container.addEventListener("mousedown", (event) => {
      event.preventDefault();
      moveCursorToWidget(view, container);
    });
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    fillTableRow(headRow, this.model.header, this.model.aligns, "th");
    head.append(headRow);
    table.append(head);
    if (this.model.rows.length > 0) {
      const body = document.createElement("tbody");
      for (const cells of this.model.rows) {
        const bodyRow = document.createElement("tr");
        fillTableRow(bodyRow, cells, this.model.aligns, "td");
        body.append(bodyRow);
      }
      table.append(body);
    }
    container.append(table);
    return container;
  }
}
