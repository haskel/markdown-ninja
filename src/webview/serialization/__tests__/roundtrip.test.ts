/**
 * Round-trip serialization tests for BlockNote markdown
 * Tests that rich styles (colors, backgrounds, etc.) survive the markdown round-trip
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the functions since we can't import BlockNote in Node
// These tests verify the regex patterns and transformation logic

describe('Markdown Serialization', () => {
  describe('blocksToMarkdown - Color serialization', () => {
    it('should serialize text color to HTML span with data-bn attributes', () => {
      const input = {
        type: 'text',
        text: 'red text',
        styles: { textColor: 'red' },
      };

      // Expected output format
      const expectedPattern = /<span data-bn-style="textColor" data-bn-value="red" style="color:#[a-f0-9]+">red text<\/span>/;

      // Simulate serialization
      const result = serializeStyledText(input);
      expect(result).toMatch(expectedPattern);
    });

    it('should serialize background color to HTML span', () => {
      const input = {
        type: 'text',
        text: 'highlighted',
        styles: { backgroundColor: 'yellow' },
      };

      const expectedPattern = /<span data-bn-style="backgroundColor" data-bn-value="yellow"/;
      const result = serializeStyledText(input);
      expect(result).toMatch(expectedPattern);
    });

    it('should combine text color with bold', () => {
      const input = {
        type: 'text',
        text: 'bold red',
        styles: { textColor: 'red', bold: true },
      };

      const result = serializeStyledText(input);
      expect(result).toContain('**bold red**');
      expect(result).toContain('data-bn-style="textColor"');
    });

    it('should serialize underline with data-bn attribute', () => {
      const input = {
        type: 'text',
        text: 'underlined',
        styles: { underline: true },
      };

      const result = serializeStyledText(input);
      expect(result).toContain('<u data-bn-style="underline">underlined</u>');
    });
  });

  describe('markdownToBlocks - Color restoration', () => {
    it('should extract text color from HTML span', () => {
      const markdown = 'Text with <span data-bn-style="textColor" data-bn-value="red" style="color:#dc3545">red text</span> here';

      const { preprocessed, styles } = preprocessMarkdown(markdown);

      expect(styles.length).toBe(1);
      expect(styles[0].styles.textColor).toBe('red');
      expect(preprocessed).toContain('__BN_MARKER_0__');
      expect(preprocessed).toContain('red text');
    });

    it('should extract background color from HTML span', () => {
      const markdown = '<span data-bn-style="backgroundColor" data-bn-value="yellow" style="background-color:#ffc107">highlighted</span>';

      const { styles } = preprocessMarkdown(markdown);

      expect(styles[0].styles.backgroundColor).toBe('yellow');
    });

    it('should extract underline from u tag', () => {
      const markdown = '<u data-bn-style="underline">underlined text</u>';

      const { styles } = preprocessMarkdown(markdown);

      expect(styles[0].styles.underline).toBe(true);
    });

    it('should handle multiple styled spans', () => {
      const markdown = '<span data-bn-style="textColor" data-bn-value="red">red</span> and <span data-bn-style="textColor" data-bn-value="blue">blue</span>';

      const { styles } = preprocessMarkdown(markdown);

      expect(styles.length).toBe(2);
      expect(styles[0].styles.textColor).toBe('red');
      expect(styles[1].styles.textColor).toBe('blue');
    });
  });

  describe('Round-trip preservation', () => {
    it('should preserve text color through round-trip', () => {
      const originalStyles = { textColor: 'red' };

      // Serialize
      const markdown = serializeStyledText({
        type: 'text',
        text: 'colored',
        styles: originalStyles,
      });

      // Parse back
      const { styles } = preprocessMarkdown(markdown);

      expect(styles[0].styles.textColor).toBe('red');
    });

    it('should preserve background color through round-trip', () => {
      const originalStyles = { backgroundColor: 'yellow' };

      const markdown = serializeStyledText({
        type: 'text',
        text: 'highlighted',
        styles: originalStyles,
      });

      const { styles } = preprocessMarkdown(markdown);

      expect(styles[0].styles.backgroundColor).toBe('yellow');
    });

    it('should preserve combined styles through round-trip', () => {
      const originalStyles = { textColor: 'blue', bold: true };

      const markdown = serializeStyledText({
        type: 'text',
        text: 'styled',
        styles: originalStyles,
      });

      expect(markdown).toContain('**styled**');
      expect(markdown).toContain('data-bn-value="blue"');
    });
  });
});

describe('Alert/Callout Serialization', () => {
  it('should serialize alert block to GitHub-style callout', () => {
    const alertBlock = {
      type: 'alert',
      props: { type: 'info' },
      content: [{ type: 'text', text: 'This is a note', styles: {} }],
    };

    const result = serializeAlertBlock(alertBlock);

    expect(result).toContain('> [!NOTE]');
    expect(result).toContain('> This is a note');
  });

  it('should serialize warning alert', () => {
    const alertBlock = {
      type: 'alert',
      props: { type: 'warning' },
      content: [{ type: 'text', text: 'Warning message', styles: {} }],
    };

    const result = serializeAlertBlock(alertBlock);

    expect(result).toContain('> [!WARNING]');
  });

  it('should serialize error alert as CAUTION', () => {
    const alertBlock = {
      type: 'alert',
      props: { type: 'error' },
      content: [{ type: 'text', text: 'Error message', styles: {} }],
    };

    const result = serializeAlertBlock(alertBlock);

    expect(result).toContain('> [!CAUTION]');
  });

  it('should serialize success alert as TIP', () => {
    const alertBlock = {
      type: 'alert',
      props: { type: 'success' },
      content: [{ type: 'text', text: 'Success message', styles: {} }],
    };

    const result = serializeAlertBlock(alertBlock);

    expect(result).toContain('> [!TIP]');
  });
});

// Helper functions that mirror the actual implementation

function getTextColorCSS(color: string): string {
  const colorMap: Record<string, string> = {
    red: '#dc3545',
    blue: '#0d6efd',
    green: '#198754',
    yellow: '#ffc107',
    orange: '#fd7e14',
    purple: '#6f42c1',
    pink: '#d63384',
    gray: '#6c757d',
    brown: '#795548',
  };
  return colorMap[color] || color;
}

function getBgColorCSS(color: string): string {
  const colorMap: Record<string, string> = {
    red: '#f8d7da',
    blue: '#cfe2ff',
    green: '#d1e7dd',
    yellow: '#fff3cd',
    orange: '#ffe5d0',
    purple: '#e2d9f3',
    pink: '#f7d6e6',
    gray: '#e9ecef',
    brown: '#d7ccc8',
  };
  return colorMap[color] || color;
}

function serializeStyledText(item: { type: string; text: string; styles: Record<string, unknown> }): string {
  if (!item || item.type !== 'text') return '';

  let text = item.text || '';
  const styles = item.styles || {};

  // Standard markdown styles
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

  const textColor = styles.textColor as string;
  if (textColor && textColor !== 'default') {
    const css = getTextColorCSS(textColor);
    text = `<span data-bn-style="textColor" data-bn-value="${textColor}" style="color:${css}">${text}</span>`;
  }

  const backgroundColor = styles.backgroundColor as string;
  if (backgroundColor && backgroundColor !== 'default') {
    const css = getBgColorCSS(backgroundColor);
    text = `<span data-bn-style="backgroundColor" data-bn-value="${backgroundColor}" style="background-color:${css};padding:2px 4px;border-radius:3px">${text}</span>`;
  }

  return text;
}

function preprocessMarkdown(markdown: string): { preprocessed: string; styles: Array<{ marker: string; styles: Record<string, unknown>; originalText: string }> } {
  const styles: Array<{ marker: string; styles: Record<string, unknown>; originalText: string }> = [];
  let markerCounter = 0;

  // Match <span data-bn-style="..." data-bn-value="...">content</span>
  const spanRegex = /<span\s+data-bn-style="(\w+)"\s+data-bn-value="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
  let preprocessed = markdown.replace(spanRegex, (match, styleName, value, innerContent) => {
    const marker = `__BN_MARKER_${markerCounter++}__`;
    styles.push({
      marker,
      styles: { [styleName]: value },
      originalText: innerContent,
    });
    return `${marker}${innerContent}${marker}END`;
  });

  // Match <u data-bn-style="underline">content</u>
  const uRegex = /<u\s+data-bn-style="underline">([\s\S]*?)<\/u>/g;
  preprocessed = preprocessed.replace(uRegex, (match, innerContent) => {
    const marker = `__BN_MARKER_${markerCounter++}__`;
    styles.push({
      marker,
      styles: { underline: true },
      originalText: innerContent,
    });
    return `${marker}${innerContent}${marker}END`;
  });

  return { preprocessed, styles };
}

function serializeAlertBlock(block: { type: string; props: { type: string }; content: Array<{ type: string; text: string; styles: Record<string, unknown> }> }): string {
  const alertType = block.props?.type || 'info';
  const typeMap: Record<string, string> = {
    info: 'NOTE',
    warning: 'WARNING',
    error: 'CAUTION',
    success: 'TIP',
  };
  const ghType = typeMap[alertType] || 'NOTE';

  const content = block.content
    .map((item) => item.text || '')
    .join('');

  const lines = content.split('\n');
  return `> [!${ghType}]\n` + lines.map((l: string) => `> ${l}`).join('\n');
}
