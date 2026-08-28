import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range, Text } from "@codemirror/state";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import {
  directiveRegionsField,
  frontmatterField,
  selectionTouches,
  type DirectiveFence,
} from "./documentRegions.ts";
import {
  BulletWidget,
  CodeFenceInfoWidget,
  DirectiveFenceWidget,
  HorizontalRuleWidget,
  TaskCheckboxWidget,
  type DirectiveFenceEdge,
} from "./widgets.ts";

const hideDeco = Decoration.replace({});
const linkTextDeco = Decoration.mark({ class: "nef-link" });
const inlineCodeDeco = Decoration.mark({ class: "nef-inline-code" });
const footnoteRefDeco = Decoration.mark({ class: "nef-footnote-ref" });
const listMarkDeco = Decoration.mark({ class: "nef-list-mark" });
const directiveSourceDeco = Decoration.mark({ class: "nef-directive-source" });
const quoteLineDeco = Decoration.line({ class: "nef-quote-line" });
const codeLineDeco = Decoration.line({ class: "nef-code-line" });
const directiveLineDeco = Decoration.line({ class: "nef-directive-line" });
const frontmatterLineDeco = Decoration.line({ class: "nef-frontmatter-line" });
const frontmatterFenceDeco = Decoration.line({
  class: "nef-frontmatter-line nef-frontmatter-fence",
});
const footnoteDefLineDeco = Decoration.line({ class: "nef-footnote-def" });
const bulletDeco = Decoration.replace({ widget: new BulletWidget() });
const horizontalRuleDeco = Decoration.replace({
  widget: new HorizontalRuleWidget(),
});

const footnoteDefPattern = /^\[\^[^\s\]]+\]:/;
const atxHeadingNames = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
]);
const codeContextNames = new Set(["FencedCode", "CodeBlock", "CodeText"]);

type VisibleRange = { from: number; to: number };

class InlineDecorationBuilder {
  private readonly ranges: Range<Decoration>[] = [];
  private readonly decoratedLines = new Set<string>();
  private readonly doc: Text;

  constructor(private readonly state: EditorState) {
    this.doc = state.doc;
  }

  build(visibleRanges: readonly VisibleRange[]): DecorationSet {
    const frontmatter = this.state.field(frontmatterField);
    for (const visibleRange of visibleRanges) {
      syntaxTree(this.state).iterate({
        from: visibleRange.from,
        to: visibleRange.to,
        enter: (node) => {
          if (
            frontmatter &&
            node.name !== "Document" &&
            node.to <= frontmatter.to
          ) {
            return false;
          }
          return this.enterNode(node.name, node.node, visibleRange);
        },
      });
      this.decorateScannedLines(visibleRange, frontmatter?.to ?? null);
      this.decorateDirectives(visibleRange);
    }
    return Decoration.set(this.ranges, true);
  }

  private touches(from: number, to: number): boolean {
    return selectionTouches(this.state, from, to);
  }

  private lineTouched(pos: number): boolean {
    const line = this.doc.lineAt(pos);
    return this.touches(line.from, line.to);
  }

  private hide(from: number, to: number): void {
    if (
      from < to &&
      this.doc.lineAt(from).number === this.doc.lineAt(to).number
    ) {
      this.ranges.push(hideDeco.range(from, to));
    }
  }

  private addLineDeco(lineStart: number, deco: Decoration, key: string): void {
    const dedupeKey = `${key}:${lineStart}`;
    if (this.decoratedLines.has(dedupeKey)) {
      return;
    }
    this.decoratedLines.add(dedupeKey);
    this.ranges.push(deco.range(lineStart));
  }

  private decorateLinesIn(
    from: number,
    to: number,
    visibleRange: VisibleRange,
    deco: Decoration,
    key: string,
  ): void {
    const first = this.doc.lineAt(Math.max(from, visibleRange.from));
    const last = this.doc.lineAt(Math.min(to, visibleRange.to));
    for (let n = first.number; n <= last.number; n++) {
      this.addLineDeco(this.doc.line(n).from, deco, key);
    }
  }

  private enterNode(
    name: string,
    node: SyntaxNode,
    visibleRange: VisibleRange,
  ): boolean | undefined {
    if (name === "Table") {
      return false;
    }
    if (atxHeadingNames.has(name)) {
      this.handleAtxHeading(node);
      return undefined;
    }
    switch (name) {
      case "FencedCode":
        this.handleFencedCode(node, visibleRange);
        return false;
      case "CodeBlock":
        this.decorateLinesIn(
          node.from,
          node.to,
          visibleRange,
          codeLineDeco,
          "code",
        );
        return false;
      case "InlineCode":
        this.handleInlineCode(node);
        return false;
      case "Link":
        return this.handleLink(node);
      case "Image":
        this.handleImage(node);
        return false;
      case "Autolink":
        this.handleAutolink(node);
        return false;
      case "URL":
        this.handleBareUrl(node);
        return undefined;
      case "EmphasisMark":
      case "StrikethroughMark":
        this.handleEmphasisMark(node);
        return undefined;
      case "Blockquote":
        this.decorateLinesIn(
          node.from,
          node.to,
          visibleRange,
          quoteLineDeco,
          "quote",
        );
        return undefined;
      case "QuoteMark":
        this.handleQuoteMark(node);
        return undefined;
      case "ListMark":
        this.handleListMark(node);
        return undefined;
      case "TaskMarker":
        this.handleTaskMarker(node);
        return undefined;
      case "HorizontalRule":
        this.handleHorizontalRule(node);
        return undefined;
      default:
        return undefined;
    }
  }

  private handleAtxHeading(heading: SyntaxNode): void {
    if (this.lineTouched(heading.from)) {
      return;
    }
    for (const mark of heading.getChildren("HeaderMark")) {
      if (mark.from === heading.from) {
        const hasTrailingSpace =
          this.state.sliceDoc(mark.to, mark.to + 1) === " ";
        this.hide(mark.from, hasTrailingSpace ? mark.to + 1 : mark.to);
      } else {
        const hasLeadingSpace =
          this.state.sliceDoc(mark.from - 1, mark.from) === " ";
        this.hide(hasLeadingSpace ? mark.from - 1 : mark.from, mark.to);
      }
    }
  }

  private handleFencedCode(code: SyntaxNode, visibleRange: VisibleRange): void {
    this.decorateLinesIn(
      code.from,
      code.to,
      visibleRange,
      codeLineDeco,
      "code",
    );
    const marks = code.getChildren("CodeMark");
    const openMark = marks[0];
    if (!openMark || openMark.from !== code.from) {
      return;
    }
    if (!this.lineTouched(openMark.from)) {
      const info = code.getChild("CodeInfo");
      let language = "";
      let fenceEnd = openMark.to;
      if (info) {
        language = this.state.sliceDoc(info.from, info.to);
        fenceEnd = info.to;
      }
      this.ranges.push(
        Decoration.replace({ widget: new CodeFenceInfoWidget(language) }).range(
          openMark.from,
          fenceEnd,
        ),
      );
    }
    const closeMark = marks.at(-1);
    if (
      closeMark &&
      closeMark !== openMark &&
      !this.lineTouched(closeMark.from)
    ) {
      this.hide(closeMark.from, closeMark.to);
    }
  }

  private handleInlineCode(code: SyntaxNode): void {
    const marks = code.getChildren("CodeMark");
    const openMark = marks[0];
    const closeMark = marks.at(-1);
    if (!openMark || !closeMark || openMark === closeMark) {
      return;
    }
    if (openMark.to < closeMark.from) {
      this.ranges.push(inlineCodeDeco.range(openMark.to, closeMark.from));
    }
    if (!this.touches(code.from, code.to)) {
      this.hide(openMark.from, openMark.to);
      this.hide(closeMark.from, closeMark.to);
    }
  }

  private handleLink(link: SyntaxNode): boolean | undefined {
    const marks = link.getChildren("LinkMark");
    const openMark = marks[0];
    const closeMark = marks[1];
    if (!openMark || !closeMark) {
      return;
    }
    const url = link.getChild("URL");
    if (!url) {
      if (this.state.sliceDoc(openMark.to, openMark.to + 1) === "^") {
        this.ranges.push(footnoteRefDeco.range(link.from, link.to));
        return false;
      }
      return;
    }
    if (this.touches(link.from, link.to)) {
      return;
    }
    if (openMark.to < closeMark.from) {
      this.ranges.push(linkTextDeco.range(openMark.to, closeMark.from));
    }
    this.hide(openMark.from, openMark.to);
    this.hide(closeMark.from, link.to);
  }

  private handleImage(image: SyntaxNode): void {
    if (!this.touches(image.from, image.to)) {
      this.hide(image.from, image.to);
    }
  }

  private handleAutolink(autolink: SyntaxNode): void {
    const url = autolink.getChild("URL");
    if (url) {
      this.ranges.push(linkTextDeco.range(url.from, url.to));
    }
    if (this.touches(autolink.from, autolink.to)) {
      return;
    }
    for (const mark of autolink.getChildren("LinkMark")) {
      this.hide(mark.from, mark.to);
    }
  }

  private handleBareUrl(url: SyntaxNode): void {
    const parentName = url.parent?.name;
    if (
      parentName === "Link" ||
      parentName === "Image" ||
      parentName === "Autolink"
    ) {
      return;
    }
    this.ranges.push(linkTextDeco.range(url.from, url.to));
  }

  private handleEmphasisMark(mark: SyntaxNode): void {
    const parent = mark.parent;
    if (parent && !this.touches(parent.from, parent.to)) {
      this.hide(mark.from, mark.to);
    }
  }

  private handleQuoteMark(mark: SyntaxNode): void {
    if (this.lineTouched(mark.from)) {
      return;
    }
    const hasTrailingSpace = this.state.sliceDoc(mark.to, mark.to + 1) === " ";
    this.hide(mark.from, hasTrailingSpace ? mark.to + 1 : mark.to);
  }

  private handleListMark(mark: SyntaxNode): void {
    const markText = this.state.sliceDoc(mark.from, mark.to);
    const isBullet = markText === "-" || markText === "*" || markText === "+";
    if (!isBullet || this.lineTouched(mark.from)) {
      this.ranges.push(listMarkDeco.range(mark.from, mark.to));
      return;
    }
    const taskChild = mark.parent ? mark.parent.getChild("Task") : null;
    if (taskChild) {
      const hasTrailingSpace =
        this.state.sliceDoc(mark.to, mark.to + 1) === " ";
      this.hide(mark.from, hasTrailingSpace ? mark.to + 1 : mark.to);
      return;
    }
    this.ranges.push(bulletDeco.range(mark.from, mark.to));
  }

  private handleTaskMarker(marker: SyntaxNode): void {
    if (this.lineTouched(marker.from)) {
      return;
    }
    const markerText = this.state.sliceDoc(marker.from, marker.to);
    const isChecked = markerText === "[x]" || markerText === "[X]";
    this.ranges.push(
      Decoration.replace({ widget: new TaskCheckboxWidget(isChecked) }).range(
        marker.from,
        marker.to,
      ),
    );
  }

  private handleHorizontalRule(rule: SyntaxNode): void {
    if (!this.lineTouched(rule.from)) {
      this.ranges.push(horizontalRuleDeco.range(rule.from, rule.to));
    }
  }

  private decorateScannedLines(
    visibleRange: VisibleRange,
    frontmatterEnd: number | null,
  ): void {
    const first = this.doc.lineAt(visibleRange.from);
    const last = this.doc.lineAt(visibleRange.to);
    for (let n = first.number; n <= last.number; n++) {
      const line = this.doc.line(n);
      if (frontmatterEnd !== null && line.to <= frontmatterEnd) {
        const deco =
          line.text === "---" ? frontmatterFenceDeco : frontmatterLineDeco;
        this.addLineDeco(line.from, deco, "frontmatter");
        continue;
      }
      if (footnoteDefPattern.test(line.text) && !this.isCodeLine(line.from)) {
        this.addLineDeco(line.from, footnoteDefLineDeco, "footnote");
      }
    }
  }

  private isCodeLine(pos: number): boolean {
    for (
      let node: SyntaxNode | null = syntaxTree(this.state).resolveInner(pos, 1);
      node;
      node = node.parent
    ) {
      if (codeContextNames.has(node.name)) {
        return true;
      }
    }
    return false;
  }

  private decorateDirectives(visibleRange: VisibleRange): void {
    for (const region of this.state.field(directiveRegionsField)) {
      if (region.to < visibleRange.from || region.from > visibleRange.to) {
        continue;
      }
      this.decorateLinesIn(
        region.from,
        region.to,
        visibleRange,
        directiveLineDeco,
        "directive",
      );
      const openEdge: DirectiveFenceEdge =
        region.kind === "container" ? "open" : "leaf";
      this.decorateDirectiveFence(region.open, region.name, openEdge);
      if (region.close) {
        this.decorateDirectiveFence(region.close, region.name, "close");
      }
    }
  }

  private decorateDirectiveFence(
    fence: DirectiveFence,
    name: string,
    edge: DirectiveFenceEdge,
  ): void {
    if (this.touches(fence.lineFrom, fence.lineTo)) {
      if (fence.lineFrom < fence.lineTo) {
        this.ranges.push(
          directiveSourceDeco.range(fence.lineFrom, fence.lineTo),
        );
      }
      return;
    }
    this.ranges.push(
      Decoration.replace({
        widget: new DirectiveFenceWidget(name, edge),
      }).range(fence.lineFrom, fence.lineTo),
    );
  }
}

function buildInlineDecorations(view: EditorView): DecorationSet {
  return new InlineDecorationBuilder(view.state).build(view.visibleRanges);
}

class LivePreviewPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildInlineDecorations(view);
  }

  update(update: ViewUpdate): void {
    const treeChanged =
      syntaxTree(update.state) !== syntaxTree(update.startState);
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.selectionSet ||
      treeChanged
    ) {
      this.decorations = buildInlineDecorations(update.view);
    }
  }
}

export const inlinePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (plugin) => plugin.decorations,
});
