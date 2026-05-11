# Claude Model Router

Recommends the right Claude model for your prompt — before you send it.
Works on `claude.ai` (browser overlay), Claude Code CLI (terminal hook), and Claude Code in VS Code (same hook).

---

## Modules

| Module | Where it runs | What it does |
|---|---|---|
| `extension/` | chrome.ai in browser | Floating overlay with live analysis, auto-switch button |
| `claude-code-hook/` | Claude Code CLI + VS Code | Hook that prints recommendation + `/model` command per prompt |

Each module is self-contained. Install one, both, or neither.

---

## Browser Extension

### Install

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. Open `claude.ai` — the overlay appears top-right

### First-time setup

Click the ⚡ icon in the Chrome toolbar.
Select your current Claude model and click **Save**.

The overlay will detect model changes from Claude's UI automatically every 2 seconds, so this is only needed as a fallback.

### What the overlay shows

```
⚡ Claude Router
─────────────────────────────────────
Task          Debugging
Complexity    Medium (5/10)
Current model Claude Opus          ← detected from Claude's UI
─────────────────────────────────────
Recommended   Claude Sonnet
Speed         Standard — Good balance of speed and quality
Opus Quota    Good default. Save Opus for heavier tasks.
─────────────────────────────────────
⚠ Opus may be overkill — switch to save quota and get a faster response.

[ Switch to Claude Sonnet ]  [ Copy ]
─────────────────────────────────────
Coding/debugging task. Sonnet is the best balance.
```

**Switch to [Model]** — tries to auto-click Claude's model selector.
**Copy** — copies the model name to clipboard if auto-switch fails.

Developer reference: [docs/BROWSER_EXTENSION.md](docs/BROWSER_EXTENSION.md)

---

## Claude Code Hook (CLI + VS Code)

### Install

```bash
cd claude-code-hook
bash install.sh
```

Requires Node.js ≥ 16. No npm packages needed.

### What it does

Every time you submit a prompt in Claude Code, the hook prints:

```
⚡ Claude Model Router
──────────────────────────────────────────────────
  Task:         Architecture / System Design
  Complexity:   High (8/10)
  Tokens:       ~24
  Current:      Claude Sonnet
──────────────────────────────────────────────────
  Recommended:  Claude Opus
  Speed:        Slower — worth it for complex tasks
  Quota:        Use your Opus quota here.
──────────────────────────────────────────────────
  ⚠  Current model may be too weak for this task.
──────────────────────────────────────────────────
  To switch before your next prompt, run:
  /model claude-opus-4-7
──────────────────────────────────────────────────
```

Run `/model claude-opus-4-7` and your next prompt will use Opus.
The hook re-reads your current model on every prompt, so it always reflects the latest setting.

Developer reference: [docs/CLAUDE_CODE_HOOK.md](docs/CLAUDE_CODE_HOOK.md)

---

## VS Code

Same hook as the CLI. Install once, works in both.
Output appears in `View → Output → Claude Code`.

Developer reference: [docs/VSCODE.md](docs/VSCODE.md)

---

## How the classification works

1. **Token estimation** — `max(chars/4, words*1.3)` — heuristic, shown as `~N`
2. **Task classification** — keyword matching across 11 categories, requires ≥2 matches for confidence
3. **Complexity scoring** — 0–10 based on prompt length, keywords, and task type
4. **Model recommendation** — rule-based mapping of task + complexity to Haiku / Sonnet / Opus
5. **Warning** — fires when your current model rank differs from the recommendation

Architecture reference: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Privacy

All analysis runs locally. Nothing is sent to any server.

| Module | What is stored |
|---|---|
| Browser extension | Only your model preference in `chrome.storage.local` |
| Claude Code hook | Nothing — stateless per invocation |

---

## Project structure

```
Claude bar/
├── extension/              Browser extension (chrome.ai)
│   ├── manifest.json
│   ├── content.js
│   ├── analyzer.js
│   ├── modelRules.js
│   ├── overlay.css
│   ├── popup.html / popup.js
│   ├── storage.js
│   └── icons/
├── claude-code-hook/       CLI + VS Code hook
│   ├── classifier.js
│   ├── hook.js
│   └── install.sh
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BROWSER_EXTENSION.md
│   ├── CLAUDE_CODE_HOOK.md
│   └── VSCODE.md
└── README.md
```
