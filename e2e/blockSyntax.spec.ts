import { Text } from "@codemirror/state";
import { expect, test } from "@playwright/test";
import type { BlockSchema } from "../electron/ipcContract.cts";
import {
  attributeReplacements,
  blockFieldProblems,
  insertedAttributes,
  labelEdit,
  leafTextProblem,
  pairedAltNames,
  REQUIRED_MESSAGE,
  writtenBlockOptions,
} from "../src/pages/Site/blockOptionsModel.ts";
import {
  attributeValuesFrom,
  blockSourceLines,
  closingFenceOf,
  containerFenceLength,
  labelSource,
  labelTextOf,
  parseDirectiveLine,
  quoteAttributeValue,
  rewriteDirectiveLine,
} from "../src/pages/Site/blockSyntax.ts";
import { computeDirectiveRegions } from "../src/pages/Site/livePreview/documentRegions.ts";

const badgeSchema: BlockSchema = {
  label: "Badge",
  description: null,
  body: "none",
  placeholder: null,
  text: null,
  attributes: {
    href: {
      type: "url",
      label: "Link",
      description: null,
      required: true,
      default: null,
      example: null,
    },
    caption: {
      type: "text",
      label: "Caption",
      description: null,
      required: false,
      multiline: false,
      default: null,
      example: null,
    },
    tone: {
      type: "select",
      label: "Tone",
      description: null,
      required: false,
      options: [
        { value: "calm", label: "Calm" },
        { value: "loud", label: "Loud" },
      ],
      default: "calm",
    },
    highlighted: {
      type: "boolean",
      label: "Highlighted",
      description: null,
      required: false,
      default: false,
    },
    framed: {
      type: "boolean",
      label: "Framed",
      description: null,
      required: false,
      default: true,
    },
    size: {
      type: "select",
      label: "Size",
      description: null,
      required: true,
      options: [
        { value: "small", label: "Small" },
        { value: "large", label: "Large" },
      ],
      default: "small",
    },
  },
};

function valuesOf(line: string): Record<string, string> {
  const parsed = parseDirectiveLine(line);
  return attributeValuesFrom(parsed?.attributes?.tokens ?? []);
}

test("directive lines parse into leaves and containers with their fence length", () => {
  expect(parseDirectiveLine("::toc")).toMatchObject({
    kind: "leaf",
    name: "toc",
    fenceLength: 2,
    attributes: null,
  });
  expect(parseDirectiveLine(':::column{heading="Left"}')).toMatchObject({
    kind: "container",
    name: "column",
    fenceLength: 3,
  });
  expect(parseDirectiveLine('::::columns{gap="wide"}  ')).toMatchObject({
    kind: "container",
    name: "columns",
    fenceLength: 4,
  });
  expect(parseDirectiveLine("   :::gallery[Holiday [2024]]")).toMatchObject({
    kind: "container",
    name: "gallery",
    fenceFrom: 3,
    headTo: "   :::gallery[Holiday [2024]]".length,
  });
});

test("lines remark-directive would not read as a block are rejected", () => {
  for (const line of [
    "::not a directive",
    ":::name{unclosed",
    "::name-",
    ":: name",
    "    :::indented",
    '::name{a="b"c}',
    "::name{a=}",
    "::name[unclosed",
    "::name{a=b`}",
    ":::",
    "plain text",
  ]) {
    expect(parseDirectiveLine(line), line).toBeNull();
  }
});

test("attribute values decode references, quotes, shortcuts, and bare flags", () => {
  expect(
    valuesOf(
      '::x{t="Tom &amp; Jerry" q=\'say "hi"\' n="a&#10;b" u=plain flag}',
    ),
  ).toEqual({
    t: "Tom & Jerry",
    q: 'say "hi"',
    n: "a\nb",
    u: "plain",
    flag: "",
  });
  expect(valuesOf('::x{#main .a .b class="c" k = "spaced"}')).toEqual({
    id: "main",
    class: "a b c",
    k: "spaced",
  });
  expect(valuesOf('::x{a="1" a="2"}')).toEqual({ a: "2" });
});

test("closing fences are colons alone", () => {
  expect(closingFenceOf(":::")).toEqual({ from: 0, length: 3 });
  expect(closingFenceOf("  ::::  ")).toEqual({ from: 2, length: 4 });
  expect(closingFenceOf(":::name")).toBeNull();
  expect(closingFenceOf("::")).toBeNull();
});

test("attribute values are quoted so they read back exactly", () => {
  expect(quoteAttributeValue("Left")).toBe('"Left"');
  expect(quoteAttributeValue('say "hi"')).toBe("'say \"hi\"'");
  expect(quoteAttributeValue(`it's "both"`)).toBe('"it\'s &quot;both&quot;"');
  expect(quoteAttributeValue("Tom & Jerry")).toBe('"Tom & Jerry"');
  expect(quoteAttributeValue("AT&T &amp; co")).toBe('"AT&amp;T &amp;amp; co"');
  expect(quoteAttributeValue("one\ntwo")).toBe('"one&#10;two"');
  for (const value of [
    "plain",
    'say "hi"',
    `it's "both"`,
    "a & b",
    "&copy &amp; &#169;",
    "line one\nline two",
    "{braces} and = signs < >",
    "back`tick",
  ]) {
    expect(valuesOf(`::x{v=${quoteAttributeValue(value)}}`), value).toEqual({
      v: value,
    });
  }
});

test("a container's fence is one colon longer than the longest fence inside it", () => {
  expect(containerFenceLength("")).toBe(3);
  expect(containerFenceLength("Some text.")).toBe(3);
  expect(containerFenceLength(':::column{heading="Left"}\nLeft.\n:::')).toBe(4);
  expect(containerFenceLength("::::outer\n:::inner\nText.\n:::\n::::")).toBe(5);
  expect(blockSourceLines("badge", "none", '{href="/"}', null)).toEqual({
    lines: ['::badge{href="/"}'],
    cursorLine: 0,
    isCursorAtLineEnd: true,
  });
  expect(
    blockSourceLines(
      "columns",
      "markdown",
      "",
      ':::column{heading="Left"}\nLeft.\n:::\n',
    ).lines,
  ).toEqual([
    "::::columns",
    ':::column{heading="Left"}',
    "Left.",
    ":::",
    "::::",
  ]);
  expect(blockSourceLines("note", "markdown", "", null).lines).toEqual([
    ":::note",
    "",
    ":::",
  ]);
});

test("inserted attributes omit empty optional fields and declared defaults", () => {
  expect(
    insertedAttributes(badgeSchema, {
      href: "/about",
      caption: "",
      tone: "calm",
      highlighted: false,
      framed: true,
      size: "small",
    }),
  ).toBe('{href="/about" size="small"}');
  expect(
    insertedAttributes(badgeSchema, {
      href: " https://example.com ",
      caption: 'He said "go"',
      tone: "loud",
      highlighted: true,
      framed: false,
      size: "large",
    }),
  ).toBe(
    `{href="https://example.com" caption='He said "go"' tone="loud" highlighted framed="false" size="large"}`,
  );
});

test("required fields and malformed links are reported before writing", () => {
  expect(
    blockFieldProblems(
      badgeSchema,
      { href: "", tone: "calm", size: "small" },
      null,
    ),
  ).toEqual({ href: REQUIRED_MESSAGE });
  expect(
    Object.keys(
      blockFieldProblems(
        badgeSchema,
        { href: "about us", size: "small" },
        null,
      ),
    ),
  ).toEqual(["href"]);
});

test("editing options rewrites declared attributes and keeps the rest verbatim", () => {
  const line =
    '::badge{#intro href="/old" data-x=\'keep "me"\' .wide tone="loud"}';
  const parsed = parseDirectiveLine(line);
  expect(parsed).not.toBeNull();
  if (parsed === null) {
    return;
  }
  const original = writtenBlockOptions(
    badgeSchema,
    attributeValuesFrom(parsed.attributes?.tokens ?? []),
    null,
  );
  expect(original.values).toMatchObject({
    href: "/old",
    tone: "loud",
    highlighted: false,
    size: "small",
  });
  const replacements = attributeReplacements(
    badgeSchema,
    { ...original.values, href: "/new", tone: "calm", highlighted: true },
    original,
  );
  expect(rewriteDirectiveLine(line, parsed, { attributes: replacements })).toBe(
    '::badge{#intro href="/new" data-x=\'keep "me"\' .wide highlighted size="small"}',
  );
  expect(
    rewriteDirectiveLine(line, parsed, {
      attributes: attributeReplacements(badgeSchema, original.values, {
        ...original,
        writtenNames: new Set(["href", "tone", "size"]),
      }),
    }),
  ).toBe(line);
  const bare = parseDirectiveLine("::badge[Read more]");
  if (bare === null) {
    throw new Error("expected a leaf");
  }
  expect(
    rewriteDirectiveLine("::badge[Read more]", bare, {
      attributes: new Map([["href", 'href="/x"']]),
    }),
  ).toBe('::badge[Read more]{href="/x"}');
});

const buttonSchema: BlockSchema = {
  label: "Button",
  description: null,
  body: "none",
  placeholder: null,
  text: { label: "Button text", description: null, required: true },
  attributes: {
    href: {
      type: "url",
      label: "Link",
      description: null,
      required: true,
      default: null,
      example: "/about",
    },
    icon: {
      type: "image",
      label: "Icon",
      description: null,
      required: false,
      alt: "iconAlt",
      default: null,
      example: null,
    },
    iconAlt: {
      type: "text",
      label: "Icon description",
      description: null,
      required: false,
      multiline: false,
      default: null,
      example: null,
    },
  },
};

test("a leaf's inline text reads back, rewrites alone, and escapes stray brackets", () => {
  const line = '::button[Read [more]]{#cta href="/old" data-x="keep"}';
  const parsed = parseDirectiveLine(line);
  if (parsed === null) {
    throw new Error("expected a leaf");
  }
  expect(labelTextOf(line, parsed)).toBe("Read [more]");
  const original = writtenBlockOptions(
    buttonSchema,
    attributeValuesFrom(parsed.attributes?.tokens ?? []),
    labelTextOf(line, parsed),
  );
  expect(original.text).toBe("Read [more]");
  expect(labelEdit(buttonSchema, original.text, original)).toBeUndefined();
  expect(
    rewriteDirectiveLine(line, parsed, {
      attributes: attributeReplacements(
        buttonSchema,
        original.values,
        original,
      ),
      label: labelEdit(buttonSchema, original.text, original),
    }),
  ).toBe(line);
  expect(
    rewriteDirectiveLine(line, parsed, {
      attributes: new Map(),
      label: labelEdit(buttonSchema, " Learn more ", original),
    }),
  ).toBe('::button[Learn more]{#cta href="/old" data-x="keep"}');
  expect(
    rewriteDirectiveLine(line, parsed, {
      attributes: new Map(),
      label: labelEdit(
        {
          ...buttonSchema,
          text: { label: "Button text", description: null, required: false },
        },
        "",
        original,
      ),
    }),
  ).toBe('::button{#cta href="/old" data-x="keep"}');
  expect(labelSource("Half [price")).toBe(String.raw`Half \[price`);
  expect(labelSource("a ] b [c] d\\")).toBe(String.raw`a \] b [c] d\\`);
  expect(labelSource("two\nlines")).toBe("two lines");
  for (const text of ["Half [price", "a ] b [c] d\\", "[x]](y"]) {
    const written = `::button[${labelSource(text)}]`;
    expect(parseDirectiveLine(written), written).not.toBeNull();
  }
  expect(
    blockSourceLines("button", "none", '{href="/"}', null, "Go").lines,
  ).toEqual(['::button[Go]{href="/"}']);
  expect(leafTextProblem(buttonSchema, "  ")).toBe(REQUIRED_MESSAGE);
  expect(leafTextProblem(buttonSchema, "Go")).toBeNull();
  expect(leafTextProblem(badgeSchema, "")).toBeNull();
  expect(pairedAltNames(buttonSchema)).toEqual(new Set(["iconAlt"]));
});

function scannedRegions(lines: string[]) {
  const doc = Text.of(lines);
  return computeDirectiveRegions(doc).map((region) => ({
    kind: region.kind,
    name: region.name,
    fenceLength: region.fenceLength,
    openLine: doc.lineAt(region.open.lineFrom).number,
    closeLine:
      region.close === null ? null : doc.lineAt(region.close.lineFrom).number,
    lastLine: doc.lineAt(region.to).number,
  }));
}

test("the line scanner follows fence lengths the way remark-directive closes containers", () => {
  expect(
    scannedRegions([
      '::::columns{gap="wide"}',
      ':::column{heading="Left"}',
      "Left.",
      ":::",
      "::toc",
      "::::",
    ]),
  ).toEqual([
    {
      kind: "container",
      name: "columns",
      fenceLength: 4,
      openLine: 1,
      closeLine: 6,
      lastLine: 6,
    },
    {
      kind: "container",
      name: "column",
      fenceLength: 3,
      openLine: 2,
      closeLine: 4,
      lastLine: 4,
    },
    {
      kind: "leaf",
      name: "toc",
      fenceLength: 2,
      openLine: 5,
      closeLine: null,
      lastLine: 5,
    },
  ]);
  expect(scannedRegions([":::a", ":::b", "x", ":::", "y"])).toEqual([
    {
      kind: "container",
      name: "a",
      fenceLength: 3,
      openLine: 1,
      closeLine: 4,
      lastLine: 4,
    },
    {
      kind: "container",
      name: "b",
      fenceLength: 3,
      openLine: 2,
      closeLine: null,
      lastLine: 3,
    },
  ]);
  expect(scannedRegions(["::::a", "```", ":::b", "```", "::::"])).toEqual([
    {
      kind: "container",
      name: "a",
      fenceLength: 4,
      openLine: 1,
      closeLine: 5,
      lastLine: 5,
    },
  ]);
  expect(scannedRegions(["::not a block", ":::open", "text"])).toEqual([
    {
      kind: "container",
      name: "open",
      fenceLength: 3,
      openLine: 2,
      closeLine: null,
      lastLine: 3,
    },
  ]);
});
