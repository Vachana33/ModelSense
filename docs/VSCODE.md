# VS Code Extension — Developer Reference

## How it works

The VS Code Claude Code extension uses the **same hook system** as the CLI. The `UserPromptSubmit` hook configured in `~/.claude/settings.json` fires identically whether you are using the terminal CLI or the VS Code panel.

**No separate VS Code-specific code is needed.**

---

## Install

Run the same installer as the CLI hook:

```bash
cd "claude-code-hook"
bash install.sh
```

This writes the hook into `~/.claude/settings.json`, which Claude Code reads regardless of whether it is running in the terminal or inside VS Code.

---

## Where the output appears

When you submit a prompt in the VS Code Claude Code panel, the hook output (the recommendation block) is printed in the **Claude Code output channel** before Claude's response appears.

To see it in VS Code:

```
View → Output → Claude Code
```

Or use the Command Palette:

```
> Claude Code: Show Output
```

---

## Model switching in VS Code

The hook prints the `/model` command. To apply it:

1. Open the Claude Code chat panel in VS Code
2. Type the printed command, e.g.:

```
/model claude-sonnet-4-6
```

3. Press Enter
4. Claude Code updates `~/.claude/settings.json` and uses the new model from the next prompt onward

The hook will confirm the new model on the next prompt submission:

```
✓  Current model matches the recommendation.
```

---

## Keyboard shortcut to open Claude Code panel

Default: `Cmd + Shift + ,` (Mac) or `Ctrl + Shift + ,` (Windows/Linux)

You can remap it in VS Code keybindings:

```json
{
  "key": "cmd+shift+c",
  "command": "claude.openPanel"
}
```

---

## Differences from the browser extension

| Feature | Browser Extension | Claude Code (CLI + VS Code) |
|---|---|---|
| Overlay position | Floating panel on claude.ai | Output channel / terminal |
| Current model read | DOM detection + popup setting | `~/.claude/settings.json` |
| Model switch | Auto-click attempt + copy button | `/model` command (manual) |
| Refresh trigger | Every keystroke (debounced) | Every prompt submission |
| Works on | claude.ai only | Any project in Claude Code |

---

## Debugging the hook in VS Code

If the hook output does not appear:

1. Check the Claude Code Output channel for errors
2. Verify the hook is registered:

```bash
cat ~/.claude/settings.json | grep hook
```

3. Test the hook manually by piping a prompt:

```bash
echo '{"prompt": "design a scalable api"}' | node /path/to/claude-code-hook/hook.js
```

4. Verify Node.js is in PATH from within VS Code's integrated terminal:

```bash
node --version
```

If Node.js is not found from VS Code but works in your system terminal, the issue is VS Code's PATH. Fix by adding Node.js to your shell profile (`~/.zshrc` or `~/.bash_profile`).
