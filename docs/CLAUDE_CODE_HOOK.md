# Claude Code Hook — Developer Reference

## What it does

A `UserPromptSubmit` hook that fires every time you press Enter in the Claude Code CLI or VS Code extension. It classifies your prompt, reads your current model from `~/.claude/settings.json`, prints a recommendation and — if needed — the exact `/model` command to switch.

---

## File structure

```
claude-code-hook/
├── classifier.js    Classification logic (Node.js module — mirrors browser analyzer)
├── hook.js          Hook entry point — reads stdin, calls classifier, prints output
└── install.sh       Installer — writes hook config into ~/.claude/settings.json
```

---

## How Claude Code hooks work

Claude Code supports hooks configured in `~/.claude/settings.json`. The `UserPromptSubmit` event fires before Claude processes your prompt.

### Hook invocation

Claude Code calls the hook command as a subprocess and pipes a JSON payload to stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/.claude/transcript.json",
  "cwd": "/current/working/directory",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "the full text of what the user submitted"
}
```

### Hook output

- Anything written to **stdout** is shown to the user before Claude responds
- Anything written to **stderr** is logged but not shown
- **Exit code 0**: hook succeeded, Claude proceeds normally
- **Exit code 2**: blocks the prompt (we never use this)

The hook always exits 0 — it never blocks a prompt.

---

## Settings.json structure after install

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/claude-code-hook/hook.js"
          }
        ]
      }
    ]
  }
}
```

`matcher: ""` means the hook fires on every prompt regardless of content.

---

## Install

```bash
cd "claude-code-hook"
bash install.sh
```

The installer:
1. Verifies Node.js is available
2. Makes `hook.js` executable
3. Reads existing `~/.claude/settings.json` (or creates it)
4. Injects the hook entry using a Node.js JSON manipulation script (no `jq` dependency)
5. Writes the result back to `settings.json`
6. Prints confirmation

---

## Manual install

If you prefer not to run the installer:

1. Open `~/.claude/settings.json` (create it if it doesn't exist)
2. Add the hook entry:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /ABSOLUTE/PATH/TO/claude-code-hook/hook.js"
          }
        ]
      }
    ]
  }
}
```

Use the absolute path to `hook.js`. Relative paths will not work.

---

## How the hook reads the current model

`hook.js` calls `readCurrentModel()`, which checks these files in order:

1. `~/.claude/settings.json` → `settings.model`
2. `<cwd>/.claude/settings.json` → `settings.model`

It then maps the full model ID to a short key using `MODEL_ID_TO_KEY`:

```js
{
  "claude-haiku-4-5-20251001": "haiku",
  "claude-sonnet-4-6":         "sonnet",
  "claude-opus-4-7":           "opus"
}
```

If the model field is absent or unrecognised, it defaults to `"sonnet"`.

### Changing your model (how the setting gets written)

When you run `/model claude-sonnet-4-6` in Claude Code, it updates `~/.claude/settings.json`. The next prompt submission will pick up the new value automatically because the hook re-reads the file on every invocation.

---

## Example output

### Simple prompt: "rewrite this email politely"

```
⚡ Claude Model Router
──────────────────────────────────────────────────
  Task:         Writing / Rewriting
  Complexity:   Low (2/10)
  Tokens:       ~7
  Current:      Claude Opus
──────────────────────────────────────────────────
  Recommended:  Claude Haiku
  Speed:        Fast — ~4x faster than Opus
  Quota:        Save your Opus quota for harder tasks.
──────────────────────────────────────────────────
  ⚠  Current model may be overkill — switch to save quota and get a faster response.
──────────────────────────────────────────────────
  To switch before your next prompt, run:
  /model claude-haiku-4-5-20251001
──────────────────────────────────────────────────
  Reason: Simple language task detected. Haiku handles this fast and well.
```

### Complex prompt: "Design a multi-agent RAG architecture…"

```
⚡ Claude Model Router
──────────────────────────────────────────────────
  Task:         Architecture / System Design
  Complexity:   High (8/10)
  Tokens:       ~18
  Current:      Claude Sonnet
──────────────────────────────────────────────────
  Recommended:  Claude Opus
  Speed:        Slower — ~4x slower than Haiku — worth it for complex tasks
  Quota:        Use your Opus quota here — this is what it's for.
──────────────────────────────────────────────────
  ⚠  Current model may be too weak for this task — consider switching.
──────────────────────────────────────────────────
  To switch before your next prompt, run:
  /model claude-opus-4-7
──────────────────────────────────────────────────
  Reason: High-complexity reasoning or architecture task detected.
```

### Good match: prompt matches current model

```
  ✓  Current model matches the recommendation.
```

---

## Refreshing on every prompt

Because the hook is invoked as a subprocess on each `UserPromptSubmit` event, it automatically re-runs for every prompt in the session. No state is carried between invocations — each run is a fresh classification.

---

## Uninstall

Remove the hook entry from `~/.claude/settings.json`. The `UserPromptSubmit` array can be deleted entirely if no other hooks are registered.

---

## Requirements

- Node.js ≥ 16 (for `fs`, `path`, `os`, `process.stdin` async reading)
- Claude Code CLI or VS Code extension with hooks support
- `~/.claude/settings.json` writable

No npm packages required — `hook.js` and `classifier.js` use only Node.js built-ins.
