import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  criticMarkdownToEditorState,
  editorStateToCriticMarkdown,
} from "./critic-markup";
import { createEditorExtensions } from "./editor-extensions";

/**
 * Regression tests for fenced code block syntax highlighting.
 *
 * The reported bug: fenced code renders without per-token highlighting, so a
 * `go` block looks like plain uncolored text instead of the language-aware
 * coloring users expect from GitHub/VSCode. The language IS captured (the
 * `<code>` keeps its `language-go` class), but no token spans are produced.
 *
 * highlight.js (via lowlight) emits `hljs-`-prefixed token classes, so their
 * presence/absence in the live editor DOM is the observable behavior. These
 * tests drive the real render path: markdown -> criticMarkdownToEditorState ->
 * live `new Editor` -> `editor.view.dom`.
 */

const editors: Editor[] = [];

function mountEditor(markdown: string): Editor {
  const { doc } = criticMarkdownToEditorState(markdown);
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: createEditorExtensions(""),
    content: doc,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe("fenced code block syntax highlighting", () => {
  it("highlights a language-tagged code block by its language", () => {
    const markdown = [
      "```go",
      "type A struct {",
      "\tB int",
      "}",
      "```",
      "",
    ].join("\n");
    const editor = mountEditor(markdown);
    const code = editor.view.dom.querySelector("pre code");

    expect(code).not.toBeNull();
    // The language survives onto the rendered element (pins the real path).
    expect(code?.className).toContain("language-go");
    // The fix: per-token highlight spans are emitted for the tagged language.
    expect(code?.innerHTML).toContain("hljs-");
    expect(
      code?.querySelectorAll('[class*="hljs-"]').length ?? 0,
    ).toBeGreaterThan(0);
  });

  it("leaves an untagged fenced block as plain text", () => {
    const markdown = ["```", "type A struct {", "\tB int", "}", "```", ""].join(
      "\n",
    );
    const editor = mountEditor(markdown);
    const code = editor.view.dom.querySelector("pre code");

    expect(code).not.toBeNull();
    // Untagged fences must not be force-highlighted via language guessing:
    // no language class, and no highlight token spans.
    expect(code?.className ?? "").not.toContain("language-");
    expect(code?.innerHTML).not.toContain("hljs-");
    expect(code?.querySelectorAll('[class*="hljs-"]').length ?? 0).toBe(0);

    // The plaintext highlight fallback must not leak into the stored language:
    // an untagged fence has to round-trip back to a bare ``` block.
    const serialized = editorStateToCriticMarkdown(editor.getJSON(), new Map());
    expect(serialized).toContain("```\n");
    expect(serialized).not.toContain("```plaintext");
  });

  it("preserves the fence language when serializing back to markdown", () => {
    const markdown = [
      "```go",
      "type A struct {",
      "\tB int",
      "}",
      "```",
      "",
    ].join("\n");
    const editor = mountEditor(markdown);

    // Highlighting is view-only (ProseMirror decorations); it must not leak
    // into the saved markdown or drop the language tag.
    const serialized = editorStateToCriticMarkdown(editor.getJSON(), new Map());
    expect(serialized).toContain("```go");
    expect(serialized).toContain("type A struct {");
    expect(serialized).not.toContain("hljs-");
  });
});
