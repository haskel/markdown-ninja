export interface FrontmatterResult {
  frontmatter: string;
  body: string;
}

// Extract YAML frontmatter from markdown
export function extractFrontmatter(markdown: string): FrontmatterResult {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    return {
      frontmatter: `---\n${match[1]}\n---\n`,
      body: match[2],
    };
  }
  return { frontmatter: '', body: markdown };
}

// Restore frontmatter to markdown body
export function restoreFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body;
  return frontmatter + body;
}
