import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './markdownEditorProvider';

export function activate(context: vscode.ExtensionContext) {
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
}

export function deactivate() {}
