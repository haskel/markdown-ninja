import * as vscode from 'vscode';

/**
 * Provides emoji badges for markdown files in Explorer
 * based on the first H1 heading emoji
 */
export class EmojiFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {

  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private readonly disposables: vscode.Disposable[] = [];

  // Store decorations in a Map like VS Code Git extension does
  private decorations = new Map<string, vscode.FileDecoration>();

  constructor() {
    console.log('[EmojiDecorator] Constructor started');

    // Register the provider
    const registration = vscode.window.registerFileDecorationProvider(this);
    this.disposables.push(registration);
    console.log('[EmojiDecorator] Provider registered');

    // Initial scan of workspace
    this.refresh().catch(err => {
      console.error('[EmojiDecorator] refresh() error:', err);
    });

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    watcher.onDidChange(uri => this.updateDecoration(uri));
    watcher.onDidCreate(uri => this.updateDecoration(uri));
    watcher.onDidDelete(uri => {
      this.decorations.delete(uri.toString());
      this._onDidChangeFileDecorations.fire(uri);
    });

    this.disposables.push(watcher);

    // Also watch for document saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.fileName.endsWith('.md') || doc.fileName.endsWith('.markdown')) {
          this.updateDecoration(doc.uri);
        }
      })
    );

    console.log('[EmojiDecorator] Constructor completed');
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // Only process markdown files
    if (!uri.fsPath.endsWith('.md') && !uri.fsPath.endsWith('.markdown')) {
      return undefined;
    }

    const decoration = this.decorations.get(uri.toString());
    console.log('[EmojiDecorator] provideFileDecoration:', uri.fsPath, '→', decoration?.badge || 'no decoration');

    return decoration;
  }

  private async refresh(): Promise<void> {
    console.log('[EmojiDecorator] refresh() starting...');

    // Find all markdown files in workspace
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    console.log('[EmojiDecorator] Found', files.length, 'markdown files');

    for (const file of files) {
      await this.updateDecoration(file);
    }

    console.log('[EmojiDecorator] refresh() complete. Total decorations:', this.decorations.size);

    // Fire change event for all files
    if (files.length > 0) {
      this._onDidChangeFileDecorations.fire(files);
    }
  }

  private async updateDecoration(uri: vscode.Uri): Promise<void> {
    try {
      const content = await this.readFile(uri);
      const emoji = this.extractEmojiFromH1(content);

      if (emoji) {
        // Check badge length - VS Code only allows 1-2 characters
        if (emoji.length > 2) {
          console.log('[EmojiDecorator] Emoji too long, skipping:', uri.fsPath, '→', emoji, 'length:', emoji.length);
          this.decorations.delete(uri.toString());
          return;
        }

        const fullTitle = this.extractFullH1(content);
        const decoration: vscode.FileDecoration = {
          badge: emoji,
          tooltip: fullTitle || undefined
        };

        console.log('[EmojiDecorator] Setting decoration:', uri.fsPath, '→', emoji);
        this.decorations.set(uri.toString(), decoration);
      } else {
        this.decorations.delete(uri.toString());
      }

      this._onDidChangeFileDecorations.fire(uri);
    } catch (e) {
      console.error('[EmojiDecorator] Error updating decoration:', uri.fsPath, e);
      this.decorations.delete(uri.toString());
    }
  }

  private async readFile(uri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf-8');
  }

  private extractEmojiFromH1(content: string): string | null {
    // Find first H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (!h1Match) return null;

    const title = h1Match[1].trim();
    return this.extractLeadingEmoji(title);
  }

  private extractFullH1(content: string): string | null {
    // Return the full H1 title including emoji
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (!h1Match) return null;
    return h1Match[1].trim() || null;
  }

  private extractLeadingEmoji(text: string): string | null {
    if (!text) return null;

    // Match emoji at the start of string
    // This regex matches simple emoji that are 1-2 UTF-16 code units
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
    const match = text.match(emojiRegex);

    return match ? match[1] : null;
  }

  dispose(): void {
    console.log('[EmojiDecorator] Disposing...');
    this.decorations.clear();
    this._onDidChangeFileDecorations.fire(undefined);
    this.disposables.forEach(d => d.dispose());
  }
}
