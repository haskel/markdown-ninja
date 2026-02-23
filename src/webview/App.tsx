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

// Common emoji categories for slash menu
const emojiList = [
  // Smileys
  { emoji: '😀', name: 'grinning', aliases: ['smile', 'happy'] },
  { emoji: '😊', name: 'blush', aliases: ['smile', 'happy'] },
  { emoji: '😂', name: 'joy', aliases: ['laugh', 'lol'] },
  { emoji: '🥹', name: 'holding back tears', aliases: ['touched', 'emotional'] },
  { emoji: '😍', name: 'heart eyes', aliases: ['love'] },
  { emoji: '🤔', name: 'thinking', aliases: ['hmm', 'consider'] },
  { emoji: '😎', name: 'sunglasses', aliases: ['cool'] },
  { emoji: '🥳', name: 'partying', aliases: ['celebrate', 'party'] },
  // Gestures
  { emoji: '👍', name: 'thumbs up', aliases: ['yes', 'ok', 'good'] },
  { emoji: '👎', name: 'thumbs down', aliases: ['no', 'bad'] },
  { emoji: '👋', name: 'wave', aliases: ['hello', 'hi', 'bye'] },
  { emoji: '🙌', name: 'raised hands', aliases: ['celebrate', 'hooray'] },
  { emoji: '👏', name: 'clap', aliases: ['applause', 'bravo'] },
  { emoji: '🤝', name: 'handshake', aliases: ['deal', 'agree'] },
  // Objects & Symbols
  { emoji: '⭐', name: 'star', aliases: ['favorite'] },
  { emoji: '🔥', name: 'fire', aliases: ['hot', 'lit'] },
  { emoji: '💡', name: 'bulb', aliases: ['idea', 'tip'] },
  { emoji: '✅', name: 'check', aliases: ['done', 'complete', 'yes'] },
  { emoji: '❌', name: 'x', aliases: ['no', 'wrong', 'cancel'] },
  { emoji: '⚠️', name: 'warning', aliases: ['caution', 'alert'] },
  { emoji: '❗', name: 'exclamation', aliases: ['important', 'alert'] },
  { emoji: '❓', name: 'question', aliases: ['what', 'help'] },
  { emoji: '🎯', name: 'target', aliases: ['goal', 'bullseye'] },
  { emoji: '🚀', name: 'rocket', aliases: ['launch', 'fast', 'ship'] },
  { emoji: '🎉', name: 'tada', aliases: ['party', 'celebrate'] },
  { emoji: '💪', name: 'muscle', aliases: ['strong', 'flex'] },
  { emoji: '🏆', name: 'trophy', aliases: ['winner', 'champion'] },
  // Work & Tech
  { emoji: '📝', name: 'memo', aliases: ['note', 'write'] },
  { emoji: '📌', name: 'pin', aliases: ['pushpin', 'important'] },
  { emoji: '📎', name: 'paperclip', aliases: ['attachment'] },
  { emoji: '📁', name: 'folder', aliases: ['directory'] },
  { emoji: '📊', name: 'chart', aliases: ['stats', 'graph'] },
  { emoji: '💻', name: 'laptop', aliases: ['computer', 'code'] },
  { emoji: '🐛', name: 'bug', aliases: ['debug', 'error'] },
  { emoji: '🔧', name: 'wrench', aliases: ['fix', 'tool', 'settings'] },
  { emoji: '⚙️', name: 'gear', aliases: ['settings', 'config'] },
  { emoji: '🔒', name: 'lock', aliases: ['secure', 'private'] },
  // Nature & Weather
  { emoji: '☀️', name: 'sun', aliases: ['sunny', 'weather'] },
  { emoji: '🌙', name: 'moon', aliases: ['night'] },
  { emoji: '⚡', name: 'lightning', aliases: ['fast', 'electric'] },
  { emoji: '🌈', name: 'rainbow', aliases: ['colorful'] },
  // Food
  { emoji: '☕', name: 'coffee', aliases: ['cafe', 'drink'] },
  { emoji: '🍕', name: 'pizza', aliases: ['food'] },
  // Special
  { emoji: '🥷', name: 'ninja', aliases: ['stealth', 'cool'] },
  { emoji: '💎', name: 'gem', aliases: ['diamond', 'precious'] },
  { emoji: '🎨', name: 'art', aliases: ['palette', 'design', 'creative'] },
  { emoji: '🎵', name: 'music', aliases: ['note', 'song'] },
];

// Helper to insert emoji at cursor
const insertEmoji = (editor: any, emoji: string) => {
  editor.insertInlineContent([{ type: 'text', text: emoji, styles: {} }]);
};

// Custom slash menu items for alert blocks
const getCustomSlashMenuItems = (editor: any) => {
  // Get default items and filter out emoji-related ones (we provide our own)
  const defaultItems = getDefaultReactSlashMenuItems(editor).filter(
    (item) => !item.title.toLowerCase().includes('emoji')
  );

  return [
    ...defaultItems,
    // Emoji items
    ...emojiList.map((item) => ({
      title: item.name,
      subtext: item.emoji,
      onItemClick: () => insertEmoji(editor, item.emoji),
      aliases: ['emoji', ...item.aliases],
      group: 'Emoji',
      icon: <span>{item.emoji}</span>,
    })),
    // Callout items
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
};

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
