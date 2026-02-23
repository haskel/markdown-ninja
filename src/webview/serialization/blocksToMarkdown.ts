import { getTextColorCSS, getBgColorCSS } from './colorMap';

// Use flexible types for BlockNote blocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInlineContent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyledText = any;

// Main export function
export function blocksToMarkdown(blocks: AnyBlock[]): string {
  const result: string[] = [];
  let prevBlockType: string | null = null;

  for (const block of blocks) {
    const md = serializeBlock(block, 0, prevBlockType);
    if (md !== null) {
      result.push(md);
    }
    prevBlockType = block.type;
  }

  return result.join('\n\n');
}

function serializeBlock(
  block: AnyBlock,
  depth: number,
  _prevBlockType: string | null
): string | null {
  const indent = '  '.repeat(depth);
  let md = '';

  switch (block.type) {
    case 'paragraph':
      md = serializeInlineContent(block.content);
      break;

    case 'heading': {
      const level = block.props?.level || 1;
      const hashes = '#'.repeat(level);
      md = `${hashes} ${serializeInlineContent(block.content)}`;
      break;
    }

    case 'bulletListItem':
      md = `- ${serializeInlineContent(block.content).trim()}`;
      break;

    case 'numberedListItem':
      md = `1. ${serializeInlineContent(block.content).trim()}`;
      break;

    case 'checkListItem': {
      const checked = block.props?.checked;
      const check = checked ? 'x' : ' ';
      // Aggressive trim to prevent space accumulation on round-trips
      const content = serializeInlineContent(block.content).replace(/^\s+/, '').replace(/\s+$/, '');
      md = `- [${check}] ${content}`;
      break;
    }

    case 'codeBlock': {
      const lang = block.props?.language || '';
      const code = block.content?.[0]?.text || '';
      md = `\`\`\`${lang}\n${code}\n\`\`\``;
      break;
    }

    case 'table':
      md = serializeTable(block);
      break;

    case 'image': {
      const alt = block.props?.caption || block.props?.name || '';
      const url = block.props?.url || '';
      md = `![${alt}](${url})`;
      break;
    }

    case 'video': {
      md = `<video src="${block.props?.url || ''}">${block.props?.caption || ''}</video>`;
      break;
    }

    case 'audio': {
      md = `<audio src="${block.props?.url || ''}">${block.props?.caption || ''}</audio>`;
      break;
    }

    case 'file': {
      md = `[${block.props?.name || 'Download'}](${block.props?.url || ''})`;
      break;
    }

    case 'alert': {
      // Serialize as GitHub-style alert
      const alertType = block.props?.type || 'info';
      const typeMap: Record<string, string> = {
        info: 'NOTE',
        warning: 'WARNING',
        error: 'CAUTION',
        success: 'TIP',
      };
      const ghType = typeMap[alertType] || 'NOTE';
      const content = serializeInlineContent(block.content);
      const lines = content.split('\n');
      md = `> [!${ghType}]\n` + lines.map((l: string) => `> ${l}`).join('\n');
      break;
    }

    default:
      // For unknown block types, try to serialize content
      if (block.content && Array.isArray(block.content)) {
        md = serializeInlineContent(block.content);
      }
      break;
  }

  // Handle empty blocks
  if (!md && block.type === 'paragraph') {
    md = '';
  }

  // Wrap with block-level props (backgroundColor, textAlignment, textColor)
  md = wrapWithBlockProps(md, block.props);

  // Recursively serialize children (nested blocks)
  if (block.children && block.children.length > 0) {
    const childrenMd = block.children
      .map((child: AnyBlock, idx: number) =>
        serializeBlock(
          child,
          depth + 1,
          idx > 0 ? block.children[idx - 1].type : null
        )
      )
      .filter((c: string | null) => c !== null)
      .join('\n');

    if (childrenMd) {
      md += '\n' + childrenMd;
    }
  }

  return indent + md;
}

function serializeInlineContent(content: AnyInlineContent[] | AnyInlineContent | string | undefined): string {
  // Handle undefined/null
  if (!content) return '';

  // Handle string content directly
  if (typeof content === 'string') return content;

  // Handle single item (not array)
  if (!Array.isArray(content)) {
    if (content.type === 'text') {
      return serializeStyledText(content);
    }
    if (content.text) {
      return content.text;
    }
    return '';
  }

  return content
    .map((item: AnyInlineContent) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      if (item.type === 'link') {
        const linkContent = item.content || [];
        const href = item.href || '';
        const text = Array.isArray(linkContent)
          ? linkContent.map((c: AnyStyledText) => serializeStyledText(c)).join('')
          : typeof linkContent === 'string' ? linkContent : '';
        return `[${text}](${href})`;
      }
      return serializeStyledText(item);
    })
    .join('');
}

function serializeStyledText(item: AnyStyledText): string {
  if (!item || item.type !== 'text') return '';

  let text = item.text || '';
  const styles = item.styles || {};

  // Standard markdown styles (order matters: inner wrappers first)
  if (styles.code) {
    text = `\`${text}\``;
  }
  if (styles.bold) {
    text = `**${text}**`;
  }
  if (styles.italic) {
    text = `*${text}*`;
  }
  if (styles.strike) {
    text = `~~${text}~~`;
  }

  // Rich styles through HTML
  if (styles.underline) {
    text = `<u data-bn-style="underline">${text}</u>`;
  }

  const textColor = styles.textColor;
  if (textColor && textColor !== 'default') {
    const css = getTextColorCSS(textColor);
    text = `<span data-bn-style="textColor" data-bn-value="${textColor}" style="color:${css}">${text}</span>`;
  }

  const backgroundColor = styles.backgroundColor;
  if (backgroundColor && backgroundColor !== 'default') {
    const css = getBgColorCSS(backgroundColor);
    text = `<span data-bn-style="backgroundColor" data-bn-value="${backgroundColor}" style="background-color:${css};padding:2px 4px;border-radius:3px">${text}</span>`;
  }

  return text;
}

function wrapWithBlockProps(md: string, props: Record<string, unknown> | undefined): string {
  if (!props) return md;

  // Background color at block level
  const backgroundColor = props.backgroundColor as string | undefined;
  if (backgroundColor && backgroundColor !== 'default') {
    const css = getBgColorCSS(backgroundColor);
    md = `<div data-bn-prop="backgroundColor" data-bn-value="${backgroundColor}" style="background-color:${css};padding:8px;border-radius:4px;margin:4px 0">\n${md}\n</div>`;
  }

  // Text alignment
  const textAlignment = props.textAlignment as string | undefined;
  if (textAlignment && textAlignment !== 'left') {
    md = `<div data-bn-prop="textAlignment" data-bn-value="${textAlignment}" style="text-align:${textAlignment}">\n${md}\n</div>`;
  }

  // Text color at block level
  const textColor = props.textColor as string | undefined;
  if (textColor && textColor !== 'default') {
    const css = getTextColorCSS(textColor);
    md = `<div data-bn-prop="textColor" data-bn-value="${textColor}" style="color:${css}">\n${md}\n</div>`;
  }

  return md;
}

function serializeTableCell(cell: unknown): string {
  // Handle different cell formats
  if (!cell) return '';
  if (typeof cell === 'string') return cell;

  // If cell is an array of inline content arrays
  if (Array.isArray(cell)) {
    return cell.map((c: unknown) => {
      if (Array.isArray(c)) {
        return serializeInlineContent(c as AnyInlineContent[]);
      }
      return serializeInlineContent(c as AnyInlineContent);
    }).join('');
  }

  // If cell has content property (newer BlockNote structure)
  if (typeof cell === 'object' && cell !== null) {
    const cellObj = cell as Record<string, unknown>;
    if (cellObj.content) {
      return serializeInlineContent(cellObj.content as AnyInlineContent[]);
    }
    if (cellObj.text) {
      return String(cellObj.text);
    }
  }

  return '';
}

function serializeTable(block: AnyBlock): string {
  const tableContent = block.content;
  if (!tableContent) return '';

  // Handle different table structures
  let rows: unknown[] = [];
  if (tableContent.rows) {
    rows = tableContent.rows;
  } else if (Array.isArray(tableContent)) {
    rows = tableContent;
  } else {
    return '';
  }

  if (rows.length === 0) return '';

  const result: string[] = [];

  // Process first row (header)
  const firstRow = rows[0] as Record<string, unknown>;
  const firstRowCells = firstRow?.cells || firstRow;
  if (!Array.isArray(firstRowCells)) return '';

  const headerCells = firstRowCells.map((cell: unknown) => serializeTableCell(cell));
  result.push('| ' + headerCells.join(' | ') + ' |');

  // Separator
  result.push('| ' + headerCells.map(() => '---').join(' | ') + ' |');

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const rowCells = row?.cells || row;
    if (!Array.isArray(rowCells)) continue;

    const cells = rowCells.map((cell: unknown) => serializeTableCell(cell));
    result.push('| ' + cells.join(' | ') + ' |');
  }

  return result.join('\n');
}
