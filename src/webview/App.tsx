import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MantineProvider } from '@mantine/core';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  createReactBlockSpec,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, defaultProps } from '@blocknote/core';
// Removed Inter font import - using VS Code theme fonts instead
import '@blocknote/mantine/style.css';

import { markdownToBlocks, blocksToMarkdown, wrapWithFrontmatter } from './serialization';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// Alert type configurations - icons only, colors via CSS
const alertIcons = {
  info: '💡',
  warning: '⚠️',
  error: '🔴',
  success: '✅',
} as const;

// Create Alert block using createReactBlockSpec
const Alert = createReactBlockSpec(
  {
    type: 'alert',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      type: {
        default: 'info' as const,
        values: ['info', 'warning', 'error', 'success'] as const,
      },
    },
    content: 'inline',
  },
  {
    render: (props) => {
      const alertType = props.block.props.type || 'info';
      const icon = alertIcons[alertType] || alertIcons.info;

      return (
        <div className={`bn-alert bn-alert-${alertType}`}>
          <span className="bn-alert-icon" contentEditable={false}>{icon}</span>
          <div style={{ flex: 1 }} ref={props.contentRef} />
        </div>
      );
    },
  }
);

// Schema with custom alert block
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: Alert(),
  },
});

// Helper function to insert alert block
const insertAlert = (editor: any, alertType: string) => {
  const currentBlock = editor.getTextCursorPosition().block;
  const alertBlock = {
    type: 'alert' as const,
    props: { type: alertType },
  };

  if (
    currentBlock.content &&
    Array.isArray(currentBlock.content) &&
    currentBlock.content.length === 0
  ) {
    // Current block is empty, update it
    editor.updateBlock(currentBlock, alertBlock);
  } else {
    // Insert after current block
    editor.insertBlocks([alertBlock], currentBlock, 'after');
  }
};

// Custom slash menu items for alert blocks
const getCustomSlashMenuItems = (editor: any) => [
  ...getDefaultReactSlashMenuItems(editor),
  {
    title: 'Info',
    subtext: 'Info callout block',
    onItemClick: () => insertAlert(editor, 'info'),
    aliases: ['info', 'note', 'callout'],
    group: 'Callouts',
    icon: <span>💡</span>,
  },
  {
    title: 'Warning',
    subtext: 'Warning callout block',
    onItemClick: () => insertAlert(editor, 'warning'),
    aliases: ['warning', 'caution'],
    group: 'Callouts',
    icon: <span>⚠️</span>,
  },
  {
    title: 'Error',
    subtext: 'Error/danger callout block',
    onItemClick: () => insertAlert(editor, 'error'),
    aliases: ['error', 'danger', 'caution'],
    group: 'Callouts',
    icon: <span>🔴</span>,
  },
  {
    title: 'Success',
    subtext: 'Success/tip callout block',
    onItemClick: () => insertAlert(editor, 'success'),
    aliases: ['success', 'tip'],
    group: 'Callouts',
    icon: <span>✅</span>,
  },
];

function Editor() {
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const lastSentMarkdownRef = useRef<string>('');
  const isLoadingRef = useRef(false);

  const editor = useCreateBlockNote({ schema });

  const loadMarkdown = useCallback(async (markdown: string) => {
    if (!editor) return;
    if (markdown === lastSentMarkdownRef.current) return;

    isLoadingRef.current = true;
    try {
      const blocks = await markdownToBlocks(editor as any, markdown);
      if (blocks && blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks);
      }
      setIsReady(true);
    } catch (err) {
      console.error('BlockNote: Load error:', err);
    } finally {
      isLoadingRef.current = false;
    }
  }, [editor]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'load') {
        lastSentMarkdownRef.current = '';
        loadMarkdown(message.markdown);
      } else if (message.type === 'externalUpdate') {
        loadMarkdown(message.markdown);
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, [loadMarkdown]);

  useEffect(() => {
    if (!editor || !isReady) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      if (isLoadingRef.current) return;

      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        try {
          const markdown = blocksToMarkdown(editor.document);
          const fullMarkdown = wrapWithFrontmatter(markdown);
          lastSentMarkdownRef.current = fullMarkdown;
          vscode.postMessage({ type: 'update', markdown: fullMarkdown });
        } catch (err) {
          console.error('BlockNote: Save error:', err);
        }
      }, 300);
    };

    editor.onChange(handleChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [editor, isReady]);

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.body.classList.contains('vscode-dark');
      setTheme(isDark ? 'dark' : 'light');
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <BlockNoteView editor={editor} theme={theme} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            getCustomSlashMenuItems(editor).filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.aliases?.some((alias: string) =>
                  alias.toLowerCase().includes(query.toLowerCase())
                )
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}

export function App() {
  return (
    <MantineProvider>
      <Editor />
    </MantineProvider>
  );
}
