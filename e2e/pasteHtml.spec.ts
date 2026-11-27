import type { ElectronApplication, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  editorLine,
  openPage,
  pageText,
  pasteIntoEditor,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";

const pastePage =
  "---\ntitle: Paste Page\n---\n\nStart.\n\n```\ncode here\n```\n\nEnd.\n";

const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0in; font-family:"Calibri";} --></style></head>
<body lang=EN-US style='tab-interval:.5in'>
<!--StartFragment-->
<h1>Quarterly <span style='color:#C00000'>Report</span><o:p></o:p></h1>
<p class=MsoNormal>This is <b>bold</b>, <i>italic</i> and <a href="https://example.com/report">a
link</a>.<o:p></o:p></p>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
<h2>Highlights<o:p></o:p></h2>
<p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Revenue grew<o:p></o:p></p>
<p class=MsoListParagraphCxSpMiddle style='margin-left:1.0in;text-indent:-.25in;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='font-family:"Courier New"'><span style='mso-list:Ignore'>o<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span></span><![endif]>Mostly in <span style='font-weight:bold'>spring</span><o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span></span><![endif]>Costs fell<o:p></o:p></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span></span><![endif]>Plan<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-.25in;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span></span><![endif]>Ship<o:p></o:p></p>
<blockquote style='margin-left:.5in'><p class=MsoNormal><span style='color:#595959'>Quoted words</span><o:p></o:p></p></blockquote>
<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;mso-yfti-tbllook:1184'>
 <tr style='mso-yfti-irow:0;mso-yfti-firstrow:yes'>
  <td width=312 valign=top style='width:233.75pt;border:solid windowtext 1.0pt'><p class=MsoNormal>Name<o:p></o:p></p></td>
  <td width=312 valign=top style='width:233.75pt;border:solid windowtext 1.0pt'><p class=MsoNormal>Amount<o:p></o:p></p></td>
 </tr>
 <tr style='mso-yfti-irow:1;mso-yfti-lastrow:yes'>
  <td width=312 valign=top><p class=MsoNormal>Apples<o:p></o:p></p></td>
  <td width=312 valign=top><p class=MsoNormal>3<o:p></o:p></p></td>
 </tr>
</table>
<p class=MsoNormal><span style='mso-spacerun:yes'>&nbsp;</span><o:p></o:p></p>
<!--EndFragment-->
</body>
</html>`;

const wordMarkdown = [
  "## Quarterly Report",
  "",
  "This is **bold**, *italic* and [a link](https://example.com/report).",
  "",
  "## Highlights",
  "",
  "- Revenue grew",
  "  - Mostly in **spring**",
  "- Costs fell",
  "",
  "1. Plan",
  "2. Ship",
  "",
  "> Quoted words",
  "",
  "| Name | Amount |",
  "| --- | --- |",
  "| Apples | 3 |",
].join("\n");

const googleDocsHtml =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-5a1b2c3d-7fff-8e9f-0a1b-2c3d4e5f6a7b"><h1 dir="ltr" style="line-height:1.38;margin-top:20pt;margin-bottom:6pt;"><span style="font-size:20pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:400;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre;white-space:pre-wrap;">Trip notes</span></h1><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;font-weight:400;font-style:normal;white-space:pre-wrap;">We packed </span><span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;font-weight:700;font-style:normal;white-space:pre-wrap;">light</span><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;"> and </span><span style="font-size:11pt;font-weight:400;font-style:italic;white-space:pre-wrap;">early</span><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">. See </span><a href="https://www.google.com/url?q=https://maps.example.com/trip&amp;sa=D&amp;source=editors&amp;ust=1" style="text-decoration:none;"><span style="font-size:11pt;color:#1155cc;font-weight:400;text-decoration:underline;-webkit-text-decoration-skip:none;white-space:pre-wrap;">the map</span></a><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-weight:400;text-decoration:line-through;-webkit-text-decoration-skip:none;white-space:pre-wrap;">Old plan</span></p><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;font-family:Arial,sans-serif;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Tent</span></p></li><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:circle;font-size:11pt;" aria-level="2"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Pegs</span></p></li></ul><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Stove</span></p></li></ul><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;white-space:pre-wrap;"></span></p><div dir="ltr" style="margin-left:0pt;" align="left"><table style="border:none;border-collapse:collapse;"><colgroup><col width="301"><col width="301"></colgroup><tbody><tr style="height:0pt"><td style="border-left:solid #000000 1pt;vertical-align:top;padding:5pt 5pt 5pt 5pt;overflow:hidden;overflow-wrap:break-word;"><p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Day</span></p></td><td style="border-left:solid #000000 1pt;vertical-align:top;"><p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Distance | km</span></p></td></tr><tr style="height:0pt"><td style="vertical-align:top;"><p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Monday</span></p></td><td style="vertical-align:top;"><p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-weight:700;white-space:pre-wrap;">12</span></p></td></tr></tbody></table></div><ul style="margin-top:0;margin-bottom:0;"><li dir="ltr" role="checkbox" aria-checked="true" style="list-style-type:none;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Book campsite</span></p></li><li dir="ltr" role="checkbox" aria-checked="false" style="list-style-type:none;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation"><span style="font-size:11pt;font-weight:400;white-space:pre-wrap;">Buy gas</span></p></li></ul></b><br class="Apple-interchange-newline">';

const googleDocsMarkdown = [
  "## Trip notes",
  "",
  "We packed **light** and *early*. See [the map](https://maps.example.com/trip).",
  "",
  "~~Old plan~~",
  "",
  "- Tent",
  "  - Pegs",
  "- Stove",
  "",
  String.raw`| Day | Distance \| km |`,
  "| --- | --- |",
  "| Monday | **12** |",
  "",
  "- [x] Book campsite",
  "- [ ] Buy gas",
].join("\n");

async function openPasteSite(): Promise<{
  app: ElectronApplication;
  window: Page;
  sitePath: string;
}> {
  const sitePath = await createEditorSite({ "paste.md": pastePage });
  const { app, window } = await openSiteWithFakeCore(sitePath);
  await openPage(window, "Paste Page");
  return { app, window, sitePath };
}

async function startNewLineAfterStart(window: Page): Promise<void> {
  await editorLine(window, "Start.").click();
  await window.keyboard.press("End");
  await window.keyboard.press("Enter");
  await window.keyboard.press("Enter");
}

async function stubClipboardText(
  app: ElectronApplication,
  text: string,
): Promise<void> {
  await app.evaluate(({ clipboard }, value) => {
    clipboard.readText = () => Promise.resolve(value);
  }, text);
}

function withPasted(markdown: string): string {
  return pastePage.replace("Start.\n", `Start.\n\n${markdown}\n`);
}

test.afterEach(cleanupTestArtifacts);

test("pasting from Word keeps headings, emphasis, links, nested lists, quotes and tables as clean markdown", async () => {
  const { window, sitePath } = await openPasteSite();
  await startNewLineAfterStart(window);
  await pasteIntoEditor(window, {
    text: "Quarterly Report\nThis is bold, italic and a link.",
    html: wordHtml,
  });
  await expect
    .poll(() => pageText(sitePath, "paste.md"))
    .toBe(withPasted(wordMarkdown));
  await window.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => pageText(sitePath, "paste.md")).toBe(withPasted(""));
});

test("pasting from Google Docs drops its wrapper and styles but keeps the formatting they carry", async () => {
  const { window, sitePath } = await openPasteSite();
  await startNewLineAfterStart(window);
  await pasteIntoEditor(window, {
    text: "Trip notes\nWe packed light and early.",
    html: googleDocsHtml,
  });
  await expect
    .poll(() => pageText(sitePath, "paste.md"))
    .toBe(withPasted(googleDocsMarkdown));
});

test("plain text pastes as typed, the plain-text shortcut ignores formatting, and code keeps the raw text", async () => {
  const { app, window, sitePath } = await openPasteSite();
  const text = () => pageText(sitePath, "paste.md");

  const formatted = { text: "Bold words", html: "<p><b>Bold</b> words</p>" };
  await startNewLineAfterStart(window);
  await pasteIntoEditor(window, { text: "Just *plain* text" });
  await expect.poll(text).toBe(withPasted("Just *plain* text"));

  await stubClipboardText(app, formatted.text);
  await window.keyboard.press("Enter");
  await window.keyboard.press("Enter");
  await window.keyboard.press("ControlOrMeta+Shift+v");
  await expect.poll(text).toBe(withPasted("Just *plain* text\n\nBold words"));

  await window.keyboard.press("Enter");
  await window.keyboard.press("Enter");
  await pasteIntoEditor(window, formatted);
  await expect
    .poll(text)
    .toBe(withPasted("Just *plain* text\n\nBold words\n\n**Bold** words"));

  await editorLine(window, "code here").click();
  await window.keyboard.press("End");
  await pasteIntoEditor(window, formatted);
  await expect.poll(text).toContain("\ncode hereBold words\n");
});
