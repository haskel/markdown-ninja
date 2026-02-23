import * as vscode from 'vscode';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Track content we received from webview to avoid echo
    let lastReceivedFromWebview = '';
    let updateTimeout: ReturnType<typeof setTimeout> | undefined;

    const sendDocumentToWebview = () => {
      const content = document.getText();
      webviewPanel.webview.postMessage({
        type: 'load',
        markdown: content,
      });
    };

    // Handle messages from webview
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'ready':
            sendDocumentToWebview();
            break;

          case 'update':
            // Remember this content so we don't send it back
            lastReceivedFromWebview = message.markdown;

            if (updateTimeout) {
              clearTimeout(updateTimeout);
            }
            updateTimeout = setTimeout(async () => {
              // Only update if content actually changed
              if (document.getText() !== message.markdown) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                  document.uri,
                  new vscode.Range(0, 0, document.lineCount, 0),
                  message.markdown
                );
                await vscode.workspace.applyEdit(edit);
                // Auto-save like Notion
                await document.save();
              }
            }, 100);
            break;
        }
      }
    );

    // Handle external document changes (from other editors or Claude Code)
    const changeDocumentDisposable = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) return;
        if (e.contentChanges.length === 0) return;

        const currentContent = document.getText();

        // Don't send back content that came from webview
        if (currentContent === lastReceivedFromWebview) {
          return;
        }

        // This is an external change - send to webview
        webviewPanel.webview.postMessage({
          type: 'externalUpdate',
          markdown: currentContent,
        });
      }
    );

    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
      changeDocumentDisposable.dispose();
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'bundle.js')
    );
    const bundleCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'bundle.css')
    );
    const customStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'styles.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource};">
  <link href="${bundleCssUri}" rel="stylesheet">
  <link href="${customStyleUri}" rel="stylesheet">
  <title>BlockNote Editor</title>
</head>
<body class="vscode-light" style="height:100vh;overflow:hidden;">
  <div id="root" style="height:100%;width:100%;overflow:auto;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
