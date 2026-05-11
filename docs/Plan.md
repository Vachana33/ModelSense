# Claude Model Router + Usage Overlay — Product & Build Specification

## 1. Product Idea Summary

Build a browser extension that works on `claude.ai` and helps users choose the right Claude model before sending a prompt.

The extension adds a small floating sidebar / overlay beside the Claude chat input. While the user types a prompt, the extension analyzes the prompt and recommends which Claude model is most suitable.

It shows:
- Estimated response speed (Fast / Standard / Slower)
- Opus quota guidance (save Opus for when it matters)
- Task classification and complexity
- Model recommendation with reasoning

The core value is:

> Help users avoid burning their Opus quota on simple tasks, and avoid using weak models for complex tasks — with a speed trade-off they can actually feel.

This is not a token counter.
It is a **model-decision assistant** for Claude users.

---

## 2. Problem Statement

Most claude.ai users are on a flat subscription (Pro: ~$20/mo). They don't pay per token. But they do have a daily Opus usage limit.

For example:

- They use Opus for simple email rewrites, burning their daily quota.
- They use Haiku or Sonnet for architecture planning, getting weaker output.
- They don't know which tasks actually need Opus.
- They don't know that Haiku is 3–5x faster than Opus for the same simple task.
- They don't know when their prompt is complex enough to justify the slower, smarter model.

Claude does not currently provide a live assistant that says:

- "This task is simple — use Haiku, you'll get a response 4x faster."
- "This task needs Opus — use it now, it's worth it."
- "You're using Opus for a rewrite — save your quota for harder tasks."
- "Sonnet is the right balance here."

---

## 3. Audience Clarification

This extension targets **claude.ai subscription users** (Free and Pro), not API users.

| Audience | Their constraint | What matters to them |
|---|---|---|
| claude.ai Pro users | Daily Opus usage limit | Quota preservation + response speed |
| claude.ai Free users | Limited model access | Getting the best result from available models |
| API users (secondary) | Pay per token | Cost (future version) |

Cost per token is **not shown in the MVP** because it is irrelevant and misleading for subscription users. A future version can add API cost mode.

---

## 4. Target Users

### Primary Users

- Developers using Claude for coding.
- Students using Claude for thesis, research, writing, explanations.
- Product managers using Claude for planning and documentation.
- Heavy Claude users who want to preserve their Opus quota.
- Users who care about response speed.

### Secondary Users

- Teams using Claude for internal workflows.
- Founders building with LLMs.
- Prompt engineers.
- AI consultants.

---

## 5. Product Positioning

> A live Claude companion that recommends the right model for your prompt, so you get the best speed and quality without burning your Opus quota.

Alternative names:

- Claude Model Copilot
- Prompt Router for Claude
- Claude Usage HUD
- ModelSwitch Assistant
- Smart Model Advisor
- Claude Bar

---

## 6. MVP Scope

The MVP should be buildable in approximately 3–6 hours.

### MVP Must Have

1. Chrome extension structure (Manifest V3).
2. Inject floating overlay into `claude.ai`.
3. Detect current text typed in the Claude prompt box.
4. Estimate token count using a simple heuristic.
5. Classify the prompt into a task type (with a minimum confidence threshold).
6. Recommend a Claude model.
7. Show reasoning for the recommendation.
8. Show response speed indicator (Fast / Standard / Slower).
9. Show Opus quota guidance when Opus is or isn't recommended.
10. Show "overkill warning" if the current model seems too powerful for the task.
11. Show "upgrade warning" if the current model may be too weak for the task.
12. User can manually set their current model in the popup (no DOM scanning for model detection).

### MVP Should Not Have

- User login.
- Cloud backend.
- Team dashboard.
- Payment system.
- Advanced analytics.
- Full token-accurate Anthropic tokenizer.
- Browser plugin marketplace polish.
- Multi-browser support.
- Support for ChatGPT / Gemini yet.
- Automatic model switching.
- Cost-per-token estimates (misleading for subscription users).
- Automatic current model detection from DOM (too unreliable — use popup setting instead).

---

## 7. Core User Flow

### Flow 1: User Types a Complex Prompt

1. User opens `claude.ai`.
2. Extension injects a floating panel near the chat input.
3. User starts typing a prompt.
4. Extension reads the prompt text from the DOM.
5. Extension analyzes: length, keyword signals, complexity score.
6. If confidence is sufficient (≥2 keyword matches or strong length signal), extension recommends a model.
7. If confidence is low, overlay shows: "Type more to analyze."
8. Overlay updates live.

Example:

User types:
```
Design a multi-agent architecture for a RAG-based funding application generator with observability and fallback handling.
```

Overlay shows:
```
Task: Architecture / System Design
Complexity: High
Recommended: Claude Opus
Speed: Slower — worth it for this task
Opus Quota: Use it here. This is what Opus is for.
Reason: Long-horizon reasoning and system design detected.
```

### Flow 2: User Types a Simple Prompt

User types:
```
Rewrite this email politely.
```

Overlay shows:
```
Task: Writing / Rewriting
Complexity: Low
Recommended: Claude Haiku
Speed: Fast — ~4x faster than Opus
Opus Quota: Save it. Haiku handles this easily.
Reason: Simple transformation task. No deep reasoning needed.
```

### Flow 3: User Types a Coding Prompt

User types:
```
Fix this React component and explain the bug.
```

Overlay shows:
```
Task: Coding / Debugging
Complexity: Medium
Recommended: Claude Sonnet
Speed: Standard
Reason: Coding task detected. Sonnet is the best balance for most code tasks.
```

---

## 8. High-Level Architecture

```
Chrome Extension
│
├── manifest.json
├── content.js
├── overlay.css
├── analyzer.js
├── modelRules.js
├── storage.js
└── popup.html / popup.js
```

| Component | Responsibility |
|---|---|
| `manifest.json` | Chrome extension configuration |
| `content.js` | Injects overlay into Claude page, watches prompt changes |
| `overlay.css` | Styles the floating panel |
| `analyzer.js` | Analyzes prompt, classifies task, scores complexity |
| `modelRules.js` | Maps task/complexity to model recommendation + speed |
| `storage.js` | Stores user preferences (current model choice) locally |
| `popup.html` | Extension popup for manually setting current model |

---

## 9. Technical Constraints

### Important Reality

Claude web app does not expose official usage or model APIs.

The extension cannot reliably know:
- Which model is currently selected (DOM scanning is unreliable — see Section 11)
- Remaining Opus quota
- Exact server-side token count
- Exact context window usage

The MVP should label all estimates as:

> Estimated — not exact.

### What the Extension Can Reliably Do

- Read visible prompt text from the DOM.
- Estimate tokens heuristically.
- Classify task type from keyword signals.
- Recommend a model.
- Show speed and quota guidance.
- Read user's manually selected current model from local storage.
- Detect visible conversation text length for rough context estimation.

---

## 10. Data Privacy Principle

The MVP runs entirely locally in the browser.

Default behavior:
- Do not send prompt text to any external server.
- Do not store prompt text permanently.
- Use local-only rule-based classification.
- Store only user preferences (e.g. current model setting) in Chrome local storage.

Privacy statement to display:

> This extension analyzes your prompt locally in your browser. No prompt data is sent anywhere.

---

## 11. Current Model Detection — Popup-Based

**Do not attempt to auto-detect the current model from the DOM.**

Reasons:
- `document.body.innerText.includes("opus")` will false-positive on any conversation *about* Opus.
- Claude.ai's model selector is a React component with dynamic class names that can change.
- False detection erodes user trust immediately.

**Instead:** Let the user set their current model once in the popup.

```
[ Claude Model Router — Settings ]

Your current model:
○ Claude Haiku
● Claude Sonnet   ← selected
○ Claude Opus

[ Save ]
```

This is stored in `chrome.storage.local` and read by `content.js` when computing warnings.

A future version (v2) can attempt smarter DOM detection once the selector is confirmed stable.

---

## 12. Overlay UI Requirements

The overlay should be:
- Fixed position, visible but not obstructive.
- Collapsible.
- Draggable (stretch goal for MVP).
- Dark/light compatible.
- High z-index.
- Small enough not to block Claude's input area.

### Default Position

**Top-right of the screen**, not bottom-right.

Bottom-right conflicts directly with Claude's own floating toolbar and model picker.

```css
#claude-router-overlay {
  position: fixed;
  right: 20px;
  top: 80px;
  width: 300px;
  z-index: 999999;
  border-radius: 16px;
  padding: 14px;
  background: rgba(24, 24, 27, 0.95);
  color: white;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  font-size: 13px;
  line-height: 1.5;
}
```

### Overlay Content

Minimum fields:

```
Claude Model Router

Task:        Coding / Debugging
Complexity:  Medium (5/10)
Recommended: Claude Sonnet ✓
Speed:       Standard
Opus Quota:  Save it for harder tasks.

Reason: Coding task detected. Sonnet handles most
        debugging and code tasks well.

[ Collapse ]
```

### Visual States

| State | Color | Meaning |
|---|---|---|
| Green | `#22c55e` | Current model matches recommendation |
| Yellow | `#eab308` | Model may be overkill (Opus for simple task) |
| Red | `#ef4444` | Model may be too weak |
| Grey | `#6b7280` | No prompt / not enough signal yet |

---

## 13. Prompt Detection

Claude.ai uses a `contenteditable` div (ProseMirror), not a standard `<textarea>`.

Use this selector priority order:

```js
function findPromptInput() {
  return (
    document.querySelector('[contenteditable="true"][role="textbox"]') ||
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('textarea') ||
    document.querySelector('[role="textbox"]')
  );
}
```

Use polling + MutationObserver because Claude is a dynamic single-page app:

```js
const observer = new MutationObserver(() => {
  attachInputListenerIfNeeded();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

setInterval(attachInputListenerIfNeeded, 1000);
```

---

## 14. Token Estimation

For MVP, use a combined heuristic:

```js
function estimateTokens(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const charBased = Math.ceil(text.length / 4);
  const wordBased = Math.ceil(words * 1.3);
  return Math.max(charBased, wordBased);
}
```

Always display as:

```
Input tokens: ~420
```

Never show as exact. A better tokenizer can be added in v2.

---

## 15. Claude Model List

```js
const MODEL_CONFIG = {
  haiku: {
    label: "Claude Haiku",
    speedLabel: "Fast",
    speedNote: "~4x faster than Opus",
    quotaNote: "Save your Opus quota.",
    strengths: ["speed", "simple tasks", "short rewrites", "translation"]
  },
  sonnet: {
    label: "Claude Sonnet",
    speedLabel: "Standard",
    speedNote: "Good balance of speed and quality",
    quotaNote: "Good default. Reserve Opus for heavy reasoning.",
    strengths: ["coding", "analysis", "balanced reasoning", "most tasks"]
  },
  opus: {
    label: "Claude Opus",
    speedLabel: "Slower",
    speedNote: "~4x slower than Haiku — worth it for complex tasks",
    quotaNote: "Use your quota here. This task benefits from Opus.",
    strengths: ["deep reasoning", "architecture", "complex planning", "research"]
  }
};
```

Pricing is intentionally excluded from MVP — it is misleading for subscription users.

---

## 16. Prompt Classification — With Confidence Threshold

The classifier should only commit to a task type when it has enough signal.

**Minimum confidence rule: ≥2 keyword matches from a rule before classifying.**

If no rule reaches ≥2 matches, fall back to length-based classification only, and show:

```
Task: General (not enough signal)
```

This prevents confident wrong answers, which destroy trust.

```js
function classifyTask(text) {
  let bestMatch = { type: "unknown", score: 0 };

  for (const rule of TASK_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > bestMatch.score) {
      bestMatch = { type: rule.type, score };
    }
  }

  // Require at least 2 keyword matches to classify with confidence
  if (bestMatch.score < 2) return "unknown";

  return bestMatch.type;
}
```

### Task Categories

| Category | Examples |
|---|---|
| `simple_rewrite` | rewrite, improve, make polite, shorten, grammar |
| `translation` | translate, German to English, übersetzen |
| `summarization` | summarize, TLDR, key points, bullet points |
| `coding_simple` | fix syntax, explain code, small function |
| `coding_complex` | architecture, refactor large codebase, full-stack |
| `debugging` | error logs, stack trace, not working, exception |
| `reasoning_deep` | compare strategies, decision, trade-offs |
| `architecture` | system design, scalable app, agent architecture |
| `research` | literature, sources, technical analysis, citation |
| `data_extraction` | extract table, JSON, fields, parse |
| `learning` | explain concept, teach me, test me, beginner |
| `planning` | roadmap, implementation plan, phases |
| `unknown` | fallback — not enough signal |

---

## 17. Task Rules

```js
const TASK_RULES = [
  {
    type: "architecture",
    keywords: ["architecture", "system design", "scalable", "pipeline", "orchestration", "multi-agent", "distributed", "microservice"]
  },
  {
    type: "coding_complex",
    keywords: ["refactor", "full stack", "fullstack", "backend", "frontend", "database schema", "production", "deploy"]
  },
  {
    type: "debugging",
    keywords: ["error", "bug", "stack trace", "not working", "exception", "crash", "undefined", "null pointer"]
  },
  {
    type: "simple_rewrite",
    keywords: ["rewrite", "make polite", "improve this email", "shorten", "grammar", "rephrase", "paraphrase"]
  },
  {
    type: "translation",
    keywords: ["translate", "übersetzen", "traduction", "into english", "into german", "into french"]
  },
  {
    type: "summarization",
    keywords: ["summarize", "summary", "tldr", "key points", "bullet points", "main points", "overview"]
  },
  {
    type: "planning",
    keywords: ["roadmap", "implementation plan", "step by step", "phases", "timeline", "milestones"]
  },
  {
    type: "research",
    keywords: ["research", "literature", "paper", "sources", "citation", "studies", "evidence"]
  },
  {
    type: "learning",
    keywords: ["explain", "teach me", "test me", "beginner", "simple terms", "how does", "what is"]
  },
  {
    type: "data_extraction",
    keywords: ["extract", "parse", "json format", "table", "csv", "structured", "fields"]
  },
  {
    type: "reasoning_deep",
    keywords: ["compare", "tradeoff", "trade-off", "decision", "pros and cons", "which is better", "evaluate"]
  }
];
```

---

## 18. Complexity Scoring

Use a score from 0–10.

| Signal | Score |
|---|---|
| Prompt < 100 tokens | +1 |
| Prompt 100–500 tokens | +2 |
| Prompt > 500 tokens | +3 |
| Contains "architecture" / "system design" | +3 |
| Contains "debug" / "error" / "stack trace" | +2 |
| Contains "step by step" / "complete" / "detailed" | +2 |
| Contains "compare" / "tradeoff" / "decision" | +2 |
| Contains "production" / "scalable" | +2 |
| Contains code block (```) | +2 |
| Task type is `simple_rewrite` or `translation` | cap score at 3 |

| Score | Label |
|---|---|
| 0–2 | Low |
| 3–6 | Medium |
| 7–10 | High |

---

## 19. Model Recommendation Rules

### Recommendation Logic

| Task Type | Complexity | Recommended Model |
|---|---|---|
| `translation` | Any | Haiku |
| `simple_rewrite` | Low | Haiku |
| `summarization` | Low | Haiku |
| `summarization` | Medium/High | Sonnet |
| `coding_simple` | Low/Medium | Sonnet |
| `debugging` | Medium | Sonnet |
| `coding_complex` | High | Sonnet or Opus |
| `architecture` | High | Opus |
| `reasoning_deep` | High | Opus |
| `research` | Medium/High | Sonnet or Opus |
| `planning` | Medium | Sonnet |
| `planning` | High | Opus |
| `learning` | Low/Medium | Sonnet |
| `unknown` | Low | Haiku |
| `unknown` | Medium | Sonnet |
| `unknown` | High | Opus |

### Recommendation Output Object

```js
{
  taskType: "architecture",
  complexityScore: 8,
  complexityLabel: "High",
  recommendedModel: "opus",
  confidence: "high",       // "high" | "medium" | "low"
  reason: "Architecture and multi-step planning signals detected.",
  speedLabel: "Slower",
  speedNote: "Worth it for this task.",
  quotaNote: "Use your Opus quota here.",
  warning: null             // or "Opus may be overkill." / "Model may be too weak."
}
```

---

## 20. Warning Logic

### Overkill Warning

If user's current model (from popup setting) is Opus and recommended model is Haiku or Sonnet:

```
⚠ Opus may be overkill for this task. You could save your quota and get a faster response with Sonnet.
```

### Weak Model Warning

If user's current model is Haiku and recommended model is Opus or Sonnet:

```
⚠ This task may need a stronger model. Consider switching to Sonnet or Opus.
```

### Long Prompt Warning

If estimated input tokens > 3000:

```
⚠ Long prompt detected. Consider splitting the task into smaller parts.
```

### Architecture Warning

If task is `architecture` and current model is not Opus:

```
ℹ For deep architecture reasoning, Opus typically produces better results.
```

### Low Confidence Notice

If classifier could not reach ≥2 keyword matches:

```
ℹ Type more to get a model recommendation.
```

---

## 21. Speed Framing

Speed is a first-class signal for subscription users who don't care about per-token cost.

| Model | Speed Label | Relative Speed |
|---|---|---|
| Haiku | Fast | ~4x faster than Opus |
| Sonnet | Standard | Good balance |
| Opus | Slower | ~4x slower than Haiku |

Display in overlay:

```
Speed: Fast — ~4x faster than Opus
```

This gives users a reason to choose Haiku beyond just "it's cheaper" — speed is tangible and immediate.

---

## 22. Suggested File Structure

```
claude-model-router-extension/
│
├── manifest.json
├── content.js
├── analyzer.js
├── modelRules.js
├── overlay.css
├── popup.html
├── popup.js
├── storage.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 23. Browser Extension Permissions

Minimal permissions:

```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://claude.ai/*"]
}
```

Do not request `"<all_urls>"` unless absolutely required.

---

## 24. Manifest File

Use Manifest V3.

```json
{
  "manifest_version": 3,
  "name": "Claude Model Router",
  "version": "0.1.0",
  "description": "Recommends the best Claude model for your prompt. Save your Opus quota. Get faster responses on simple tasks.",
  "permissions": ["storage"],
  "host_permissions": ["https://claude.ai/*"],
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["modelRules.js", "analyzer.js", "content.js"],
      "css": ["overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Claude Model Router",
    "default_popup": "popup.html"
  }
}
```

---

## 25. Implementation Plan

### Phase 1 — Extension Setup

Create:
- `manifest.json`
- `content.js`
- `overlay.css`

Goal: Extension loads on `claude.ai`. Floating overlay appears top-right.

Acceptance test:
- Open Claude.
- Overlay appears in top-right corner.
- Overlay does not block Claude's input or toolbar.

### Phase 2 — Prompt Detection

Implement:
- Flexible input finder targeting `contenteditable` first.
- Input event listener.
- MutationObserver + interval fallback.

Acceptance test:
- Type in Claude prompt.
- Overlay updates with typed prompt length.

### Phase 3 — Token Estimation

Implement:
- `estimateTokens(text)`
- Display token count in overlay.

Acceptance test:
- Short prompt shows small number.
- Long prompt shows larger number.
- Always shows `~` prefix.

### Phase 4 — Prompt Classification

Implement:
- Keyword rules with minimum match threshold (≥2).
- Task type detection.
- Complexity score.
- Low-confidence fallback message.

Acceptance test:
- "rewrite this email" → `simple_rewrite`.
- "fix React error" → `debugging`.
- "design architecture" → `architecture`.
- "hello" → `unknown` with "Type more to analyze."

### Phase 5 — Model Recommendation

Implement:
- Recommendation mapping.
- Speed label and quota note.
- Reason text.

Acceptance test:
- Simple rewrite → Haiku + "Fast" + "Save your Opus quota."
- Coding → Sonnet + "Standard."
- Deep architecture → Opus + "Slower — worth it for this task."

### Phase 6 — Popup: Current Model Setting

Implement:
- `popup.html` with radio buttons for Haiku / Sonnet / Opus.
- Save to `chrome.storage.local`.
- `content.js` reads setting on load.

Acceptance test:
- User selects Opus in popup.
- Types simple rewrite prompt.
- Overlay shows overkill warning.

### Phase 7 — Warnings

Implement:
- Overkill warning.
- Weak model warning.
- Long prompt warning.
- Architecture notice.

Acceptance test:
- Current model = Opus, task = simple_rewrite → overkill warning shown.
- Current model = Haiku, task = architecture → upgrade warning shown.

### Phase 8 — UI Polish

Implement:
- Collapsible panel.
- Color-coded status (green / yellow / red / grey).
- Compact layout.
- Drag handle (stretch goal).

Acceptance test:
- Overlay does not block Claude.
- User can collapse it.
- Colors update correctly by state.

---

## 26. Code Skeleton

### content.js

```js
let currentInputElement = null;
let currentUserModel = "sonnet"; // default

chrome.storage.local.get(["userModel"], (result) => {
  if (result.userModel) currentUserModel = result.userModel;
});

function createOverlay() {
  if (document.getElementById("claude-router-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "claude-router-overlay";
  overlay.innerHTML = `
    <div class="crm-header">
      <strong>Claude Model Router</strong>
      <button id="crm-toggle">−</button>
    </div>
    <div id="crm-body">
      <div id="crm-task">Task: —</div>
      <div id="crm-complexity">Complexity: —</div>
      <div id="crm-model">Recommended: —</div>
      <div id="crm-speed">Speed: —</div>
      <div id="crm-tokens">Tokens: —</div>
      <div id="crm-quota">Opus Quota: —</div>
      <div id="crm-warning"></div>
      <div id="crm-reason">Start typing to analyze your prompt.</div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("crm-toggle").addEventListener("click", () => {
    const body = document.getElementById("crm-body");
    const btn = document.getElementById("crm-toggle");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    btn.textContent = isHidden ? "−" : "+";
  });
}

function findPromptInput() {
  return (
    document.querySelector('[contenteditable="true"][role="textbox"]') ||
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector("textarea") ||
    document.querySelector('[role="textbox"]')
  );
}

function getInputText(input) {
  if (!input) return "";
  if ("value" in input) return input.value || "";
  return input.innerText || input.textContent || "";
}

function attachInputListenerIfNeeded() {
  const input = findPromptInput();
  if (!input || input === currentInputElement) return;
  currentInputElement = input;

  input.addEventListener("input", () => {
    handlePromptChange(getInputText(input));
  });

  handlePromptChange(getInputText(input));
}

function handlePromptChange(promptText) {
  const analysis = analyzePrompt(promptText, currentUserModel);
  updateOverlay(analysis);
}

function updateOverlay(analysis) {
  document.getElementById("crm-task").textContent = `Task: ${analysis.taskType}`;
  document.getElementById("crm-complexity").textContent =
    `Complexity: ${analysis.complexityLabel} (${analysis.complexityScore}/10)`;
  document.getElementById("crm-model").textContent =
    `Recommended: ${analysis.recommendedModelLabel}`;
  document.getElementById("crm-speed").textContent =
    `Speed: ${analysis.speedLabel} — ${analysis.speedNote}`;
  document.getElementById("crm-tokens").textContent =
    `Input tokens: ~${analysis.inputTokens}`;
  document.getElementById("crm-quota").textContent =
    `Opus quota: ${analysis.quotaNote}`;
  document.getElementById("crm-warning").textContent =
    analysis.warning ? `⚠ ${analysis.warning}` : "";
  document.getElementById("crm-reason").textContent = analysis.reason;

  const overlay = document.getElementById("claude-router-overlay");
  overlay.dataset.state = analysis.state; // "good" | "overkill" | "weak" | "idle"
}

createOverlay();

const observer = new MutationObserver(() => {
  attachInputListenerIfNeeded();
});

observer.observe(document.body, { childList: true, subtree: true });

setInterval(attachInputListenerIfNeeded, 1000);
```

### analyzer.js

```js
function estimateTokens(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const charBased = Math.ceil(text.length / 4);
  const wordBased = Math.ceil(words * 1.3);
  return Math.max(charBased, wordBased);
}

function analyzePrompt(promptText, userModel) {
  const text = (promptText || "").toLowerCase();
  const inputTokens = estimateTokens(promptText);

  if (!text.trim()) {
    return {
      taskType: "—",
      complexityScore: 0,
      complexityLabel: "—",
      recommendedModel: "none",
      recommendedModelLabel: "—",
      inputTokens: 0,
      speedLabel: "—",
      speedNote: "—",
      quotaNote: "—",
      warning: null,
      state: "idle",
      reason: "Start typing to analyze your prompt."
    };
  }

  const taskType = classifyTask(text);
  const complexityScore = calculateComplexity(text, inputTokens, taskType);
  const complexityLabel = getComplexityLabel(complexityScore);
  const recommendation = recommendModel(taskType, complexityScore);
  const warning = computeWarning(userModel, recommendation.model, taskType, inputTokens);
  const state = computeState(userModel, recommendation.model);

  return {
    taskType: formatTaskType(taskType),
    complexityScore,
    complexityLabel,
    recommendedModel: recommendation.model,
    recommendedModelLabel: MODEL_CONFIG[recommendation.model]?.label || "—",
    inputTokens,
    speedLabel: MODEL_CONFIG[recommendation.model]?.speedLabel || "—",
    speedNote: MODEL_CONFIG[recommendation.model]?.speedNote || "—",
    quotaNote: recommendation.quotaNote,
    warning,
    state,
    reason: recommendation.reason
  };
}

function formatTaskType(type) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function classifyTask(text) {
  let bestMatch = { type: "unknown", score: 0 };

  for (const rule of TASK_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > bestMatch.score) {
      bestMatch = { type: rule.type, score };
    }
  }

  if (bestMatch.score < 2) return "unknown";
  return bestMatch.type;
}

function calculateComplexity(text, inputTokens, taskType) {
  let score = 0;

  if (inputTokens < 100) score += 1;
  else if (inputTokens < 500) score += 2;
  else score += 3;

  if (text.includes("architecture") || text.includes("system design")) score += 3;
  if (text.includes("debug") || text.includes("error") || text.includes("stack trace")) score += 2;
  if (text.includes("step by step") || text.includes("complete") || text.includes("detailed")) score += 2;
  if (text.includes("tradeoff") || text.includes("trade-off") || text.includes("compare")) score += 2;
  if (text.includes("production") || text.includes("scalable")) score += 2;
  if (text.includes("```")) score += 2;

  if (taskType === "simple_rewrite" || taskType === "translation") {
    score = Math.min(score, 3);
  }

  return Math.min(score, 10);
}

function getComplexityLabel(score) {
  if (score <= 2) return "Low";
  if (score <= 6) return "Medium";
  return "High";
}

function computeWarning(userModel, recommendedModel, taskType, inputTokens) {
  if (inputTokens > 3000) return "Long prompt detected. Consider splitting the task.";

  const modelRank = { haiku: 0, sonnet: 1, opus: 2 };
  const userRank = modelRank[userModel] ?? 1;
  const recRank = modelRank[recommendedModel] ?? 1;

  if (userRank > recRank + 0) return "Opus may be overkill. You could save your quota and get a faster response.";
  if (userRank < recRank) return "Your current model may be too weak for this task. Consider switching.";
  if (taskType === "architecture" && userModel !== "opus") return "For deep architecture reasoning, Opus typically produces better results.";

  return null;
}

function computeState(userModel, recommendedModel) {
  if (!userModel || userModel === "unknown") return "idle";
  if (userModel === recommendedModel) return "good";
  const modelRank = { haiku: 0, sonnet: 1, opus: 2 };
  return modelRank[userModel] > modelRank[recommendedModel] ? "overkill" : "weak";
}
```

### modelRules.js

```js
const MODEL_CONFIG = {
  haiku: {
    label: "Claude Haiku",
    speedLabel: "Fast",
    speedNote: "~4x faster than Opus"
  },
  sonnet: {
    label: "Claude Sonnet",
    speedLabel: "Standard",
    speedNote: "Good balance of speed and quality"
  },
  opus: {
    label: "Claude Opus",
    speedLabel: "Slower",
    speedNote: "~4x slower than Haiku — worth it for complex tasks"
  }
};

const TASK_RULES = [
  {
    type: "architecture",
    keywords: ["architecture", "system design", "scalable", "pipeline", "orchestration", "multi-agent", "distributed", "microservice"]
  },
  {
    type: "coding_complex",
    keywords: ["refactor", "full stack", "fullstack", "backend", "frontend", "database schema", "production", "deploy"]
  },
  {
    type: "debugging",
    keywords: ["error", "bug", "stack trace", "not working", "exception", "crash", "undefined", "null pointer"]
  },
  {
    type: "simple_rewrite",
    keywords: ["rewrite", "make polite", "improve this email", "shorten", "grammar", "rephrase", "paraphrase"]
  },
  {
    type: "translation",
    keywords: ["translate", "übersetzen", "traduction", "into english", "into german", "into french"]
  },
  {
    type: "summarization",
    keywords: ["summarize", "summary", "tldr", "key points", "bullet points", "main points", "overview"]
  },
  {
    type: "planning",
    keywords: ["roadmap", "implementation plan", "step by step", "phases", "timeline", "milestones"]
  },
  {
    type: "research",
    keywords: ["research", "literature", "paper", "sources", "citation", "studies", "evidence"]
  },
  {
    type: "learning",
    keywords: ["explain", "teach me", "test me", "beginner", "simple terms", "how does", "what is"]
  },
  {
    type: "data_extraction",
    keywords: ["extract", "parse", "json format", "table", "csv", "structured", "fields"]
  },
  {
    type: "reasoning_deep",
    keywords: ["compare", "tradeoff", "trade-off", "decision", "pros and cons", "which is better", "evaluate"]
  }
];

function recommendModel(taskType, complexityScore) {
  if (["translation", "simple_rewrite"].includes(taskType)) {
    return {
      model: "haiku",
      reason: "Simple language task detected. Haiku handles this fast and well.",
      quotaNote: "Save your Opus quota for harder tasks."
    };
  }

  if (taskType === "summarization" && complexityScore <= 4) {
    return {
      model: "haiku",
      reason: "Short summarization detected. Haiku is sufficient.",
      quotaNote: "Save your Opus quota."
    };
  }

  if (["architecture", "reasoning_deep"].includes(taskType) || complexityScore >= 8) {
    return {
      model: "opus",
      reason: "High-complexity reasoning or architecture task detected.",
      quotaNote: "Use your Opus quota here — this is what it's for."
    };
  }

  if (["debugging", "coding_complex"].includes(taskType) && complexityScore >= 8) {
    return {
      model: "opus",
      reason: "Complex coding task detected. Opus may provide deeper reasoning.",
      quotaNote: "Worth using Opus here if the problem is tricky."
    };
  }

  if (complexityScore <= 2) {
    return {
      model: "haiku",
      reason: "Low-complexity task detected.",
      quotaNote: "Save your Opus quota."
    };
  }

  if (complexityScore <= 6) {
    return {
      model: "sonnet",
      reason: "Medium-complexity task. Sonnet is the best balance.",
      quotaNote: "Good default. Save Opus for heavier tasks."
    };
  }

  return {
    model: "opus",
    reason: "High-complexity task detected.",
    quotaNote: "Use your Opus quota here."
  };
}
```

### overlay.css

```css
#claude-router-overlay {
  position: fixed;
  right: 20px;
  top: 80px;
  width: 300px;
  z-index: 999999;
  border-radius: 16px;
  padding: 14px;
  background: rgba(24, 24, 27, 0.95);
  color: white;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  font-size: 13px;
  line-height: 1.5;
  transition: border-color 0.3s;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
}

#claude-router-overlay[data-state="good"]    { border-color: #22c55e; }
#claude-router-overlay[data-state="overkill"] { border-color: #eab308; }
#claude-router-overlay[data-state="weak"]    { border-color: #ef4444; }
#claude-router-overlay[data-state="idle"]    { border-color: rgba(255,255,255,0.08); }

.crm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

#crm-toggle {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 14px;
  line-height: 1;
}

#crm-body > div {
  margin: 5px 0;
}

#crm-model {
  font-weight: 700;
  font-size: 14px;
  margin: 8px 0 4px;
}

#crm-speed {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
}

#crm-quota {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
}

#crm-warning {
  color: #eab308;
  font-size: 12px;
  margin-top: 6px;
  min-height: 0;
}

#crm-reason {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}
```

### popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Claude Model Router</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 16px;
      width: 220px;
      background: #18181b;
      color: white;
      font-size: 13px;
    }
    h3 { margin: 0 0 12px; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; }
    label { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
    input[type="radio"] { accent-color: #a78bfa; }
    button {
      margin-top: 14px;
      width: 100%;
      padding: 8px;
      background: #a78bfa;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    button:hover { background: #7c3aed; }
    #saved { margin-top: 8px; color: #22c55e; font-size: 12px; display: none; }
  </style>
</head>
<body>
  <h3>Your Current Model</h3>
  <label><input type="radio" name="model" value="haiku"> Claude Haiku</label>
  <label><input type="radio" name="model" value="sonnet"> Claude Sonnet</label>
  <label><input type="radio" name="model" value="opus"> Claude Opus</label>
  <button id="save-btn">Save</button>
  <div id="saved">Saved.</div>
  <script src="popup.js"></script>
</body>
</html>
```

### popup.js

```js
chrome.storage.local.get(["userModel"], (result) => {
  const model = result.userModel || "sonnet";
  const radio = document.querySelector(`input[value="${model}"]`);
  if (radio) radio.checked = true;
});

document.getElementById("save-btn").addEventListener("click", () => {
  const selected = document.querySelector('input[name="model"]:checked');
  if (!selected) return;

  chrome.storage.local.set({ userModel: selected.value }, () => {
    const saved = document.getElementById("saved");
    saved.style.display = "block";
    setTimeout(() => { saved.style.display = "none"; }, 1500);
  });
});
```

---

## 27. Testing Plan

### Manual Testing on claude.ai

| Test | Expected Result |
|---|---|
| Open Claude | Overlay appears top-right, does not block toolbar |
| Type short email rewrite | Recommends Haiku + "Fast" + "Save your quota" |
| Type coding bug prompt | Recommends Sonnet + "Standard" |
| Type architecture prompt | Recommends Opus + "Slower — worth it" |
| Type one word | Shows "Type more to analyze" |
| Clear prompt | Overlay resets to idle state |
| Navigate between chats | Overlay persists |
| Collapse overlay | Body hides, button shows "+" |
| Set model to Opus in popup, type simple rewrite | Overkill warning shown, yellow border |
| Set model to Haiku in popup, type architecture prompt | Upgrade warning shown, red border |

### Example Test Prompts

```
Rewrite this email politely.
→ simple_rewrite / Haiku / Fast
```

```
Fix this React TypeScript bug and explain the root cause.
→ debugging / Sonnet / Standard
```

```
Design a scalable multi-agent architecture for an enterprise RAG application with observability, fallback handling, and evaluation.
→ architecture / Opus / Slower — worth it
```

```
Summarize this text into 5 bullet points.
→ summarization / Haiku or Sonnet
```

```
Hello
→ unknown / "Type more to analyze"
```

---

## 28. Risks

| Risk | Mitigation |
|---|---|
| Claude DOM changes break prompt detection | Use flexible selectors with fallback priority list |
| Token estimates are inaccurate | Always show `~`, label as estimated |
| Keyword classifier gives confident wrong answers | Require ≥2 matches before classifying; show "not enough signal" otherwise |
| Overlay conflicts with Claude's own UI | Fixed top-right position avoids the bottom toolbar area |
| Model detection is unreliable | Removed from MVP; user sets model manually in popup |
| Privacy concerns | Analyze locally, no backend, no external calls |

---

## 29. Future Features

### Version 2
- Optional DOM-based model detection (once selector is confirmed stable).
- Better tokenization (tiktoken-wasm or similar).
- Cost mode for API users (toggle in popup).
- "Savings if you switch" estimate (API mode only).
- Context growth meter.
- Prompt quality score.

### Version 3
- Support ChatGPT.
- Support Gemini.
- Multi-provider model comparison.
- Custom pricing configuration for API users.

### Version 4
- Local usage history.
- Prompt analytics.
- Cost spike alerts.
- Export CSV.

### Version 5
- API-based router.
- Backend proxy.
- Automatic model routing.
- Enterprise LLM gateway with full observability.

---

## 30. Business Potential

The broader product is:

> A model-selection and speed-optimization assistant for AI users.

Potential product categories:
- LLM observability
- Prompt intelligence
- AI productivity companion
- Model routing
- AI cost optimization (for API users)

Possible future customers:
- Individual Claude / ChatGPT power users
- Startups
- AI teams
- Developer teams
- Agencies
- Companies with high LLM usage

---

## 31. Differentiation

Many existing extensions focus on:
- Token counting
- Prompt saving
- UI tweaks
- Chat export
- Dark mode

This product focuses on:
- **Prompt-aware model recommendation**
- **Opus quota preservation**
- **Speed trade-off visibility**
- **Overkill / weak model warnings**
- **Task classification with confidence gating**

The unique angle:

> Do not just show usage after the fact. Help users choose better **before** they send — and frame it in terms they actually care about: speed and quota, not abstract token costs.

---

## 32. Definition of Done for MVP

The MVP is complete when:

- [ ] Extension loads on `claude.ai`.
- [ ] Overlay appears top-right without blocking Claude's toolbar.
- [ ] User can type a prompt and overlay updates live.
- [ ] Token estimate displays with `~` prefix.
- [ ] Task type appears (or "Type more to analyze" if insufficient signal).
- [ ] Complexity score appears.
- [ ] Recommended model appears.
- [ ] Speed label and note appear.
- [ ] Opus quota note appears.
- [ ] Simple prompts recommend Haiku.
- [ ] Complex prompts recommend Opus.
- [ ] Medium prompts recommend Sonnet.
- [ ] Overkill and weak-model warnings appear based on popup setting.
- [ ] User can set current model in popup.
- [ ] Overlay is collapsible.
- [ ] No external API is called.
- [ ] No prompt data is sent anywhere.
