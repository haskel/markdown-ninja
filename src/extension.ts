import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './markdownEditorProvider';
import { EmojiFileDecorationProvider } from './emojiFileDecorationProvider';

let emojiDecorationProvider: EmojiFileDecorationProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('[MarkdownNinja] Extension activating...');

  const provider = new MarkdownEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'blocknoteMarkdown.editor',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Create emoji badge decoration provider
  // It registers itself in constructor
  emojiDecorationProvider = new EmojiFileDecorationProvider();
  context.subscriptions.push(emojiDecorationProvider);
}

export function deactivate() {
  emojiDecorationProvider?.dispose();
  emojiDecorationProvider = undefined;
}
