import type { BlockNoteEditor } from '@blocknote/core';
import { extractFrontmatter, restoreFrontmatter } from './frontmatter';

// Use flexible types for BlockNote blocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInlineContent = any;

// Store frontmatter between parse and serialize
let currentFrontmatter = '';

export function getFrontmatter(): string {
  return currentFrontmatter;
}

export function setFrontmatter(fm: string): void {
  currentFrontmatter = fm;
}

// Store extracted styles during preprocessing
interface ExtractedStyle {
  styles: Record<string, unknown>;
  originalText: string;  // The text content (without HTML, but with markdown like **)
  plainText: string;     // Plain text without any formatting
}

let extractedStyles: ExtractedStyle[] = [];

// Extract plain text from markdown (remove **, *, `, etc.)
function extractPlainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/`(.+?)`/g, '$1')         // code
    .replace(/~~(.+?)~~/g, '$1');      // strike
}

// Store GitHub alerts during preprocessing
interface ExtractedAlert {
  type: string;
  content: string;
  marker: string;
}
let extractedAlerts: ExtractedAlert[] = [];

// Preprocess markdown to extract data-bn-* HTML tags and convert GitHub alerts
function preprocessMarkdown(markdown: string): string {
  extractedStyles = [];
  extractedAlerts = [];

  // Convert GitHub-style alerts to plain markers BEFORE BlockNote parses them
  // Pattern: > [!NOTE]\n> content line 1\n> content line 2
  // Important: Remove the > prefix so BlockNote parses as paragraph, not blockquote
  const ghAlertRegex = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?((?:>\s*.*(?:\n|$))*)/gim;
  let alertIndex = 0;
  markdown = markdown.replace(ghAlertRegex, (_, ghType, contentLines) => {
    // Remove the > prefix from each line
    const content = contentLines
      .split('\n')
      .map((line: string) => line.replace(/^>\s*/, ''))
      .join(' ')  // Join with space instead of newline for single paragraph
      .trim();

    const alertType = ghAlertTypeMap[ghType.toUpperCase()] || 'info';
    extractedAlerts.push({ type: alertType, content, marker: `ALERT${alertIndex}` });
    alertIndex++;

    // Use special marker that BlockNote will parse as plain paragraph (no > prefix!)
    return `ALERT_MARKER_START:${alertType}:${encodeURIComponent(content)}:ALERT_MARKER_END`;
  });

  // Match <span data-bn-style="..." data-bn-value="...">content</span>
  const spanRegex = /<span\s+data-bn-style="(\w+)"\s+data-bn-value="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
  markdown = markdown.replace(spanRegex, (_, styleName, value, innerContent) => {
    extractedStyles.push({
      styles: { [styleName]: value },
      originalText: innerContent,
      plainText: extractPlainText(innerContent),
    });
    return innerContent;  // Just return the content without the HTML wrapper
  });

  // Match <u data-bn-style="underline">content</u>
  const uRegex = /<u\s+data-bn-style="underline">([\s\S]*?)<\/u>/g;
  markdown = markdown.replace(uRegex, (_, innerContent) => {
    extractedStyles.push({
      styles: { underline: true },
      originalText: innerContent,
      plainText: extractPlainText(innerContent),
    });
    return innerContent;
  });

  // Match <div data-bn-prop="..." data-bn-value="...">content</div>
  const divRegex = /<div\s+data-bn-prop="(\w+)"\s+data-bn-value="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
  markdown = markdown.replace(divRegex, (_, propName, value, innerContent) => {
    extractedStyles.push({
      styles: { [`_block_${propName}`]: value },
      originalText: innerContent.trim(),
      plainText: extractPlainText(innerContent.trim()),
    });
    return innerContent.trim();
  });

  return markdown;
}

// Map GitHub alert types to our alert types
const ghAlertTypeMap: Record<string, string> = {
  'NOTE': 'info',
  'TIP': 'success',
  'IMPORTANT': 'info',
  'WARNING': 'warning',
  'CAUTION': 'error',
};

// Post-process blocks to restore styles from markers and convert GitHub alerts
function postprocessBlocks(blocks: AnyBlock[]): AnyBlock[] {
  const result: AnyBlock[] = [];

  for (const block of blocks) {
    // Check if this is a blockquote with GitHub-style alert syntax
    const alertBlock = tryConvertGitHubAlert(block);
    if (alertBlock) {
      result.push(alertBlock);
      continue;
    }

    let processedBlock = block;

    // Process inline content
    if (processedBlock.content && Array.isArray(processedBlock.content)) {
      let content = restoreStylesFromMarkers(processedBlock.content);

      // Fix checkbox leading spaces: trim first text element
      if (processedBlock.type === 'checkListItem' && content.length > 0) {
        const first = content[0];
        if (first.type === 'text' && first.text && first.text.startsWith(' ')) {
          content = [
            { ...first, text: first.text.trimStart() },
            ...content.slice(1),
          ];
        }
      }

      processedBlock = {
        ...processedBlock,
        content,
      };
    }

    // Recursively process children
    if (processedBlock.children && processedBlock.children.length > 0) {
      processedBlock = {
        ...processedBlock,
        children: postprocessBlocks(processedBlock.children),
      };
    }

    result.push(processedBlock);
  }

  return result;
}

// Try to convert a paragraph with alert marker to an alert block
function tryConvertGitHubAlert(block: AnyBlock): AnyBlock | null {
  if (block.type === 'paragraph' && block.content && Array.isArray(block.content)) {
    const textContent = block.content
      .map((c: AnyInlineContent) => c.text || '')
      .join('');

    // Check for our special marker: ALERT_MARKER_START:type:encodedContent:ALERT_MARKER_END
    const markerMatch = textContent.match(/ALERT_MARKER_START:(\w+):([^:]*):ALERT_MARKER_END/);
    if (markerMatch) {
      const [, alertType, encodedContent] = markerMatch;
      const content = decodeURIComponent(encodedContent);

      return {
        id: generateId(),
        type: 'alert',
        props: {
          textAlignment: 'left',
          type: alertType,
        },
        content: content.trim() ? [{ type: 'text', text: content.trim(), styles: {} }] : [],
        children: [],
      };
    }

    // Also check for raw GitHub alert syntax that wasn't preprocessed (e.g., in blockquotes)
    const alertMatch = textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)/i);
    if (alertMatch) {
      const [, ghType, content] = alertMatch;
      const alertType = ghAlertTypeMap[ghType.toUpperCase()] || 'info';

      return {
        id: generateId(),
        type: 'alert',
        props: {
          textAlignment: 'left',
          type: alertType,
        },
        content: content.trim() ? [{ type: 'text', text: content.trim(), styles: {} }] : [],
        children: [],
      };
    }
  }

  return null;
}

// Restore styles by matching plain text content and splitting text
function restoreStylesFromMarkers(content: AnyInlineContent[]): AnyInlineContent[] {
  if (!extractedStyles.length) return content;

  const result: AnyInlineContent[] = [];

  for (const item of content) {
    if (item.type !== 'text' || !item.text) {
      result.push(item);
      continue;
    }

    let text = item.text;
    const baseStyles = { ...(item.styles || {}) };
    let processed = false;

    // Try to split text by extracted styled parts
    for (const extracted of extractedStyles) {
      const idx = text.indexOf(extracted.plainText);
      if (idx !== -1) {
        // Found the styled text - split into parts
        const before = text.substring(0, idx);
        const styled = extracted.plainText;
        const after = text.substring(idx + styled.length);

        // Add text before the styled part
        if (before) {
          result.push({ type: 'text', text: before, styles: { ...baseStyles } });
        }

        // Add the styled part with extracted styles
        result.push({
          type: 'text',
          text: styled,
          styles: { ...baseStyles, ...extracted.styles },
        });

        // Continue processing the rest
        text = after;
        processed = true;
      }
    }

    // Add any remaining text
    if (text) {
      result.push({ type: 'text', text, styles: processed ? { ...baseStyles } : item.styles });
    } else if (!processed) {
      result.push(item);
    }
  }

  return result;
}

// Main function to convert markdown to BlockNote blocks
export async function markdownToBlocks(
  editor: BlockNoteEditor,
  markdown: string
): Promise<AnyBlock[]> {
  // Extract frontmatter
  const { frontmatter, body } = extractFrontmatter(markdown);
  currentFrontmatter = frontmatter;

  // Handle empty content
  if (!body.trim()) {
    return [];
  }

  // Preprocess: extract data-bn-* HTML and replace with markers
  const preprocessedBody = preprocessMarkdown(body);

  // Use BlockNote's built-in parser as base
  let blocks: AnyBlock[];
  try {
    blocks = await editor.tryParseMarkdownToBlocks(preprocessedBody);
  } catch {
    // Fallback: create single paragraph with raw content
    blocks = [
      {
        id: generateId(),
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [{ type: 'text', text: body, styles: {} }],
        children: [],
      },
    ];
  }

  // Post-process: restore styles from markers
  blocks = postprocessBlocks(blocks);

  // Also apply the old restoration logic for any missed cases
  blocks = restoreRichProps(blocks);

  return blocks;
}

// Restore the frontmatter when converting back to markdown
export function wrapWithFrontmatter(markdown: string): string {
  return restoreFrontmatter(currentFrontmatter, markdown);
}

// Recursively restore rich properties from HTML with data-bn-* attributes
function restoreRichProps(blocks: AnyBlock[]): AnyBlock[] {
  return blocks.map((block) => {
    // Process inline content
    if (block.content && Array.isArray(block.content)) {
      block = {
        ...block,
        content: restoreInlineStyles(block.content),
      };
    }

    // Check if block contains HTML wrapper with data-bn-prop
    block = unwrapBlockProps(block);

    // Recursively process children
    if (block.children && block.children.length > 0) {
      block = {
        ...block,
        children: restoreRichProps(block.children),
      };
    }

    return block;
  });
}

// Restore inline styles from HTML tags
function restoreInlineStyles(content: AnyInlineContent[]): AnyInlineContent[] {
  return content.map((item) => {
    if (item.type !== 'text') return item;

    let text = item.text || '';
    const styles = { ...(item.styles || {}) };
    let modified = false;

    // Match <span data-bn-style="textColor" data-bn-value="red" ...>text</span>
    const spanRegex =
      /<span\s+data-bn-style="(\w+)"\s+data-bn-value="([^"]+)"[^>]*>(.*?)<\/span>/g;
    let match;
    while ((match = spanRegex.exec(text)) !== null) {
      const [fullMatch, styleName, value, innerText] = match;
      styles[styleName] = value;
      text = text.replace(fullMatch, innerText);
      modified = true;
    }

    // Match <u data-bn-style="underline">text</u>
    const uRegex = /<u\s+data-bn-style="underline">(.*?)<\/u>/g;
    while ((match = uRegex.exec(text)) !== null) {
      const [fullMatch, innerText] = match;
      styles.underline = true;
      text = text.replace(fullMatch, innerText);
      modified = true;
    }

    // Match plain <u>text</u> (without data attribute)
    const plainURegex = /<u>(.*?)<\/u>/g;
    while ((match = plainURegex.exec(text)) !== null) {
      const [fullMatch, innerText] = match;
      styles.underline = true;
      text = text.replace(fullMatch, innerText);
      modified = true;
    }

    if (modified) {
      return {
        type: 'text' as const,
        text,
        styles,
      };
    }

    return item;
  });
}

// Extract block-level props from HTML wrappers
function unwrapBlockProps(block: AnyBlock): AnyBlock {
  if (block.type !== 'paragraph' || !block.content) return block;

  const content = block.content;
  if (content.length === 0) return block;

  // Get full text content
  const fullText = content
    .map((c: AnyInlineContent) => c.text || '')
    .join('');

  // Check for div wrappers with data-bn-prop
  const divRegex =
    /<div\s+data-bn-prop="(\w+)"\s+data-bn-value="([^"]+)"[^>]*>([\s\S]*?)<\/div>/;
  const match = fullText.match(divRegex);

  if (match) {
    const [, propName, value, innerContent] = match;
    const newProps = { ...block.props, [propName]: value };

    // Remove the HTML wrapper from content
    const newText = fullText.replace(divRegex, innerContent.trim());
    const newContent: AnyInlineContent[] = [
      {
        type: 'text',
        text: newText,
        styles: {},
      },
    ];

    return {
      ...block,
      props: newProps,
      content: newContent,
    };
  }

  return block;
}

// Generate a random ID for blocks
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
