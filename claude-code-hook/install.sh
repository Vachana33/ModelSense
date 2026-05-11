#!/usr/bin/env bash
# Installs the Claude Model Router hook into ~/.claude/settings.json
# Works for both Claude Code CLI and the VS Code extension.

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_PATH="$HOOK_DIR/hook.js"
SETTINGS_FILE="$HOME/.claude/settings.json"

# ── Verify Node.js is available ───────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found in PATH." >&2
  echo "Install it from https://nodejs.org and re-run this script." >&2
  exit 1
fi

echo "Node.js found: $(node --version)"

# ── Make hook executable ──────────────────────────────────────────────────────

chmod +x "$HOOK_PATH"

# ── Ensure ~/.claude directory exists ─────────────────────────────────────────

mkdir -p "$HOME/.claude"

# ── Read or initialise settings.json ─────────────────────────────────────────

if [ -f "$SETTINGS_FILE" ]; then
  CURRENT=$(cat "$SETTINGS_FILE")
else
  CURRENT="{}"
fi

# ── Inject hook using Node.js (safe JSON manipulation) ───────────────────────

node - "$CURRENT" "$HOOK_PATH" <<'EOF'
const current  = JSON.parse(process.argv[1] || "{}");
const hookPath = process.argv[2];

const hookEntry = {
  matcher: "",
  hooks: [{ type: "command", command: `node ${hookPath}` }]
};

if (!current.hooks) current.hooks = {};
if (!current.hooks.UserPromptSubmit) current.hooks.UserPromptSubmit = [];

// Remove any existing Claude Model Router entry to avoid duplicates
current.hooks.UserPromptSubmit = current.hooks.UserPromptSubmit.filter(
  (h) => !JSON.stringify(h).includes("hook.js")
);

current.hooks.UserPromptSubmit.push(hookEntry);

process.stdout.write(JSON.stringify(current, null, 2) + "\n");
EOF

# Capture the updated JSON and write it back
UPDATED=$(node - "$CURRENT" "$HOOK_PATH" <<'EOF'
const current  = JSON.parse(process.argv[1] || "{}");
const hookPath = process.argv[2];

const hookEntry = {
  matcher: "",
  hooks: [{ type: "command", command: `node ${hookPath}` }]
};

if (!current.hooks) current.hooks = {};
if (!current.hooks.UserPromptSubmit) current.hooks.UserPromptSubmit = [];

current.hooks.UserPromptSubmit = current.hooks.UserPromptSubmit.filter(
  (h) => !JSON.stringify(h).includes("hook.js")
);

current.hooks.UserPromptSubmit.push(hookEntry);
process.stdout.write(JSON.stringify(current, null, 2) + "\n");
EOF
)

echo "$UPDATED" > "$SETTINGS_FILE"

echo ""
echo "✓ Hook installed into $SETTINGS_FILE"
echo ""
echo "The hook runs automatically each time you submit a prompt in Claude Code."
echo "It prints a model recommendation and the /model command to switch if needed."
echo ""
echo "To uninstall, remove the hook.js entry from:"
echo "  $SETTINGS_FILE"
