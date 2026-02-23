# Markdown Ninja

A Notion-like WYSIWYG editor for Markdown files in VS Code.

![Markdown Ninja Demo](images/demo.gif)

## Features

- **Notion-style editing** — Write markdown with a beautiful block-based interface
- **Real-time preview** — See your formatting instantly as you type
- **Auto-save** — Changes are saved automatically, just like Notion
- **VS Code theme support** — Adapts to your light/dark theme
- **Slash commands** — Type `/` to insert blocks (headings, lists, code, callouts)
- **Keyboard shortcuts** — `Cmd+B` for bold, `Cmd+I` for italic, `Cmd+U` for underline
- **Callouts/Alerts** — Info, warning, error, and success callout blocks
- **Code blocks** — Syntax-highlighted code with language selection
- **Checkboxes** — Interactive task lists
- **Tables** — Create and edit tables visually

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X`)
3. Search for "Markdown Ninja"
4. Click Install

### From VSIX file
1. Download the `.vsix` file from [Releases](https://github.com/YOUR_USERNAME/markdown-ninja/releases)
2. In VS Code: `Cmd+Shift+P` → "Install from VSIX"
3. Select the downloaded file

## Usage

1. Open any `.md` or `.markdown` file
2. Start editing with the visual editor
3. Use `/` to open the slash menu and insert blocks
4. Your changes are saved automatically

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `Cmd+U` | Underline |
| `/` | Open slash menu |

### Slash Commands

Type `/` and then:
- `heading` — Insert heading (H1, H2, H3)
- `bullet` — Bullet list
- `numbered` — Numbered list
- `checkbox` — Task list
- `code` — Code block
- `info` / `warning` / `error` / `success` — Callout blocks
- `table` — Insert table
- `image` — Insert image

## Screenshots

### Light Theme
![Light Theme](images/light-theme.png)

### Dark Theme
![Dark Theme](images/dark-theme.png)

### Slash Menu
![Slash Menu](images/slash-menu.png)

## Requirements

- VS Code 1.85.0 or higher

## Known Issues

- Syntax highlighting in code blocks requires manual language selection
- GitHub-style alerts (`> [!NOTE]`) use internal format for now

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Built with [BlockNote](https://www.blocknotejs.org/) — the open-source block-based editor.

---

**Enjoy!** If you like this extension, please leave a review on the Marketplace.
