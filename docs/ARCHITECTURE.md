# Architecture — Developer Reference

## System overview

Claude Model Router is three independent modules that share the same classification logic but run in different environments.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Model Router                         │
├───────────────────┬───────────────────┬─────────────────────────┤
│  Browser          │  Claude Code CLI  │  VS Code Extension      │
│  Extension        │  Hook             │  Hook (same hook)       │
├───────────────────┴───────────────────┴─────────────────────────┤
│              Shared Classification Logic                        │
│  • Task keyword rules                                           │
│  • Complexity scoring                                           │
│  • Model recommendation                                         │
│  • Token estimation                                             │
└─────────────────────────────────────────────────────────────────┘
```

The classification logic is intentionally duplicated between the browser (vanilla JS globals) and the hook (Node.js CommonJS module). They are not shared via a build step because:

- The browser extension cannot import CommonJS modules without a bundler
- The hook must run as a standalone Node.js script with zero npm dependencies
- Keeping them in sync manually is acceptable given the small surface area

---

## Module breakdown

### Browser extension

```
extension/
├── modelRules.js    Global: MODEL_CONFIG, TASK_RULES, recommendModel(), estimateOutputTokens()
├── analyzer.js      Global: analyzePrompt(), classifyTask(), calculateComplexity(), estimateTokens()
└── content.js       Consumes globals from above. Manages overlay DOM, event listeners, auto-switch
```

**Execution environment:** Chrome content script, injected into `https://claude.ai/*`

**Data flow:**
```
User types → input event (debounced 120ms)
           → getInputText()
           → analyzePrompt(text, currentUserModel)  [analyzer.js uses modelRules.js globals]
           → updateOverlay(analysis)
           → DOM writes via textContent only
```

**Model source (priority):**
```
DOM detection (every 2s poll) → chrome.storage.local → default "sonnet"
```

### Claude Code hook

```
claude-code-hook/
├── classifier.js    CommonJS module: exports analyze(), MODEL_CONFIG, MODEL_ID_TO_KEY
└── hook.js          Entry point: reads stdin → calls classifier → writes stdout → exits 0
```

**Execution environment:** Node.js subprocess spawned by Claude Code on each prompt submission

**Data flow:**
```
User submits prompt → Claude Code pipes JSON to hook stdin
                    → hook.js reads stdin, parses JSON
                    → readCurrentModel() reads ~/.claude/settings.json
                    → analyze(prompt, currentModelKey)  [classifier.js]
                    → render(result) → process.stdout.write()
                    → exit(0)  [never blocks]
```

**Model source:** `~/.claude/settings.json` → `settings.model` field, re-read on every invocation

---

## Classification logic

Both the browser and hook implement the same algorithm:

### Step 1: Token estimation

```
tokens = max(ceil(chars / 4), ceil(words * 1.3))
```

Not exact — used only for complexity scoring and display. A proper tokenizer (tiktoken) would be more accurate but is not worth the dependency for an MVP.

### Step 2: Task classification

```
for each TASK_RULE:
    score = count of rule.keywords found in lowercased prompt
    track best-scoring rule

if best_score < 2:
    return "unknown"   ← confidence gate
else:
    return best_rule.type
```

The **≥2 keyword threshold** prevents single-word matches from triggering confident wrong classifications (e.g. "error" alone triggering debugging, "english" alone triggering translation).

### Step 3: Complexity scoring

Additive score capped at 10:

| Signal | +Score |
|---|---|
| Tokens < 100 | +1 |
| Tokens 100–500 | +2 |
| Tokens > 500 | +3 |
| "architecture" or "system design" | +3 |
| "debug", "error", "stack trace" | +2 |
| "step by step", "complete", "detailed" | +2 |
| "tradeoff", "trade-off", "compare" | +2 |
| "production", "scalable" | +2 |
| Code block (```) | +2 |
| Task is simple_rewrite or translation | cap at 3 |

### Step 4: Model recommendation

Priority rules applied in order:

1. `translation` or `simple_rewrite` → **Haiku** (always)
2. `summarization` with complexity ≤ 4 → **Haiku**
3. `architecture` or `reasoning_deep`, OR complexity ≥ 8 → **Opus**
4. `debugging` or `coding_complex` with complexity ≥ 8 → **Opus**
5. complexity ≤ 2 → **Haiku**
6. complexity ≤ 6 → **Sonnet**
7. complexity > 6 → **Opus**

### Step 5: Warning

```
if tokens > 3000:              "Long prompt..."
elif current_rank > rec_rank:  "Overkill..."
elif current_rank < rec_rank:  "Too weak..."
elif architecture + not opus:  "Consider Opus..."
```

Model rank: `haiku=0, sonnet=1, opus=2`

---

## Adding a new task category

1. Add a new entry to `TASK_RULES` in both `extension/modelRules.js` and `claude-code-hook/classifier.js`:

```js
{
  type: "your_type",
  keywords: ["keyword1", "keyword2", "keyword3", ...]
}
```

2. Add a display label in `formatTaskType()` in both `extension/analyzer.js` and `claude-code-hook/classifier.js`:

```js
your_type: "Human-Readable Label"
```

3. Add recommendation logic in `recommendModel()` in both files if the default complexity-based fallback is not appropriate.

4. Update the test prompts in `docs/BROWSER_EXTENSION.md`.

---

## Adding a new model

1. Add to `MODEL_CONFIG` in both `extension/modelRules.js` and `claude-code-hook/classifier.js`:

```js
newmodel: {
  label:      "Claude NewModel",
  command:    "claude-newmodel-X-Y",   // hook only
  speedLabel: "Fast",
  speedNote:  "..."
}
```

2. Add to `MODEL_ID_TO_KEY` in `claude-code-hook/classifier.js`:

```js
"claude-newmodel-X-Y": "newmodel"
```

3. Update recommendation rules and model rank in `computeWarning()` / `computeState()`.

4. Add the option to `popup.html` and `popup.js`.

---

## Why no build step

The browser extension uses vanilla JS globals (no bundler, no npm). This keeps the extension:

- Loadable directly via "Load unpacked" with zero setup
- Free of supply-chain risk from npm dependencies
- Easy to audit — what you read is what runs

The hook uses only Node.js built-ins (`fs`, `path`, `os`, `process`) for the same reason.

If the project grows (e.g. adding tiktoken, supporting multiple providers, TypeScript), a build step should be introduced at that point.

---

## Platform comparison

| Aspect | Browser Extension | Claude Code Hook |
|---|---|---|
| Language | Vanilla JS (browser globals) | Node.js (CommonJS) |
| Entry point | `content.js` injected via manifest | `hook.js` via stdin/stdout |
| Prompt source | `contenteditable` DOM element | JSON stdin from Claude Code |
| Model source | DOM detection + chrome.storage | `~/.claude/settings.json` |
| Model switch | DOM auto-click + clipboard copy | `/model` command (manual) |
| Refresh | On every keystroke (debounced) | On every prompt submission |
| Output | Floating overlay in page | Printed to Claude Code output |
| Privacy | Local only, no network | Local only, no network |
| Dependencies | None | None (Node.js built-ins only) |
