import { expect, test } from "@playwright/test";
import {
  createMarkdownProject,
  logE2eEvent,
  openMarkdownFile,
  removeMarkdownProject,
  writeProjectFile,
} from "./helpers";

test.describe("fenced code block syntax highlighting", () => {
  let projectDir: string;

  test.beforeEach(() => {
    projectDir = createMarkdownProject("code-highlighting");
  });

  test.afterEach(() => {
    removeMarkdownProject(projectDir);
  });

  test("colors tokens of a language-tagged code block @smoke", async ({
    page,
  }) => {
    const filePath = writeProjectFile(
      projectDir,
      "snippet.md",
      [
        "# Highlighting",
        "",
        "```go",
        "func add(a int, b int) int {",
        "\treturn a + b",
        "}",
        "```",
        "",
      ].join("\n"),
    );

    await openMarkdownFile(page, filePath);

    const editor = page.getByTestId("rich-text-editor");
    const codeBlock = editor.locator("pre code");
    await expect(codeBlock).toContainText("func add");

    // highlight.js token spans are produced in a real browser render.
    await expect(codeBlock.locator('[class*="hljs-"]').first()).toBeVisible();

    // The token palette actually paints: a highlighted token's computed color
    // differs from the code block's base foreground. jsdom cannot verify
    // computed styles, so this closes that gap for the CSS wiring.
    const { tokenColor, baseColor } = await page.evaluate(() => {
      const code = document.querySelector(".ProseMirror pre code");
      const tokenEl = code?.querySelector('[class*="hljs-"]');
      if (!code || !tokenEl) {
        throw new Error("expected a highlighted token in the code block");
      }
      return {
        tokenColor: getComputedStyle(tokenEl).color,
        baseColor: getComputedStyle(code).color,
      };
    });
    expect(tokenColor).not.toBe(baseColor);

    logE2eEvent("code-highlighting.rendered", {
      projectDir,
      file: "snippet.md",
    });
  });
});
