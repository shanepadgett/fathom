import MarkdownIt from "markdown-it";
import { createHighlighter } from "shiki";

const highlighter = await createHighlighter({
  themes: ["github-dark"],
  langs: ["typescript", "javascript", "json", "bash", "python"],
});
const markdown = new MarkdownIt({
  html: false,
  highlight(code, language) {
    if (!highlighter.getLoadedLanguages().includes(language)) return "";
    return highlighter.codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    });
  },
});
// Do not allow model output to load remote tracking images.
markdown.disable("image");
export function renderMarkdown(text) {
  return markdown.render(text);
}
