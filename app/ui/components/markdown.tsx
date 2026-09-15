import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false });
markdown.disable("image");
const renderLink = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (
  tokens,
  index,
  options,
  environment,
  self,
) => {
  tokens[index].attrSet("rel", "noopener noreferrer");
  tokens[index].attrSet("target", "_blank");
  return renderLink
    ? renderLink(tokens, index, options, environment, self)
    : self.renderToken(tokens, index, options);
};

/** Only the Markdown parser emits HTML; source HTML and remote images are disabled. */
export function Markdown(props: { text: string }) {
  return <div class="markdown" innerHTML={markdown.render(props.text)} />;
}
