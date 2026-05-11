# Browser Extension — Developer Reference

## What it does

Injects a floating overlay into `claude.ai` that analyzes the user's prompt in real time and recommends the best Claude model before they send.

---

## File structure

```
extension/
├── manifest.json     Chrome extension config (Manifest V3)
├── modelRules.js     Model config, task keyword rules, recommendation logic
├── analyzer.js       Token estimation, classification, complexity scoring
├── content.js        Injected into claude.ai — overlay lifecycle, DOM detection, auto-switch
├── overlay.css       Floating panel styles
├── popup.html        Extension popup UI (manual model selection)
├── popup.js          Popup logic — saves model to chrome.storage.local
├── storage.js        Thin chrome.storage.local wrapper
└── icons/            PNG icons at 16, 48, 128px
```

Script load order in `manifest.json` content_scripts:

```
modelRules.js → analyzer.js → content.js
```

`modelRules.js` and `analyzer.js` load first so their globals (`MODEL_CONFIG`, `TASK_RULES`, `analyzePrompt`) are available to `content.js`.

---

## Current model detection

### Priority order

1. **DOM detection** (runs every 2 seconds via `setInterval`)
   - Walks up the DOM tree from the prompt input element
   - Scans `button` elements within each ancestor
   - Accepts buttons with text shorter than 60 characters containing "haiku", "sonnet", or "opus"
   - Short-text filter avoids false-positives from conversation content that mentions model names

2. **`chrome.storage.local`** (fallback)
   - Set by the user through the popup
   - Used if DOM detection returns null

3. **Default: `"sonnet"`**
   - Used on first load before either source is available

### Why DOM detection can fail

Claude.ai is a React SPA. The model selector button's exact class names and DOM depth change between deployments. The current approach is deliberately flexible (walks up to 10 ancestor levels) but cannot guarantee it always finds the button.

If DOM detection fails, the popup-based setting is the reliable fallback.

---

## Auto-switch

`attemptAutoSwitch(targetModel)` in `content.js`:

1. Calls `findModelPickerButton()` — searches for the model selector button by:
   - `[data-testid*="model"]` or `[data-testid*="Model"]`
   - `button[aria-label*="model"]` or `button[aria-label*="Claude"]`
   - Fallback: buttons near the input with short text containing a model name

2. Clicks the picker button to open the dropdown

3. Waits 350 ms for the dropdown to render

4. Scans all `button`, `[role="option"]`, `[role="menuitem"]`, `[role="radio"]`, `li` elements for one containing the target model name (text < 80 chars)

5. Clicks the match, waits 200 ms, updates `currentUserModel`, persists to storage

6. If any step fails, closes the dropdown and shows the error feedback message

**Fragility note:** This relies on Claude's DOM structure remaining stable. If Anthropic changes their UI, step 1 or step 4 will fail. The copy-name fallback (`copyModelName`) is always available as a backup.

---

## Prompt detection

`findPromptInput()` tries these selectors in order:

```js
'[contenteditable="true"][role="textbox"]'  // ProseMirror (Claude's editor)
'div[contenteditable="true"]'               // generic contenteditable
'textarea'                                  // standard textarea fallback
'[role="textbox"]'                          // ARIA fallback
```

Claude uses ProseMirror, so the first selector usually matches. The others are fallbacks for future DOM changes.

`attachInputListenerIfNeeded()` runs on:
- `MutationObserver` (DOM changes — e.g. SPA navigation)
- `setInterval` every 1500 ms (edge-case fallback)

If the input element changes (e.g. Claude recreates it after navigation), the listener re-attaches automatically.

---

## Prompt lifecycle: refresh + reset

- **On each keystroke:** debounced 120 ms, then `handlePromptChange(text)` runs
- **On model change (storage):** `chrome.storage.onChanged` triggers `reanalyze()`
- **On model change (DOM poll):** `setInterval` every 2 s runs `refreshCurrentModel()`, triggers `reanalyze()` if model changed
- **On prompt cleared (send):** if `text.trim()` is empty and `lastPromptText` was not, overlay resets to idle state via `emptyAnalysis()`

This means the overlay refreshes automatically for every subsequent prompt, including after the user sends a message and starts typing a new one.

---

## Classification confidence

`classifyTask(text)` requires **≥ 2 keyword matches** from a rule before assigning a task type. Below that threshold it returns `"unknown"`.

`analyzePrompt()` checks for low confidence:

```js
const lowConfidence = taskType === "unknown" && inputTokens < 50;
```

When `lowConfidence` is true, the overlay shows:
- State: `"idle"` (grey border)
- Reason: `"Type more to get a confident recommendation."`
- Action buttons: hidden

---

## State machine

| State | Border | Trigger |
|---|---|---|
| `idle` | grey | No prompt / low confidence |
| `good` | green | Current model === recommended model |
| `overkill` | yellow | Current model rank > recommended |
| `weak` | red | Current model rank < recommended |

Model rank: `haiku=0, sonnet=1, opus=2`

---

## Security

| Concern | Mitigation |
|---|---|
| XSS from prompt text | All analysis output written via `textContent` only — never `innerHTML` |
| `dataset.state` injection | Only receives one of 4 hardcoded strings from `computeState()` |
| Overly broad permissions | Only `"storage"` + `host_permissions: ["https://claude.ai/*"]` |
| Network calls | None. No `fetch`, `XHR`, or external `src` anywhere |
| Prompt data leakage | Prompt text is analyzed in memory and never stored or sent |

---

## How to reload after code changes

1. Go to `chrome://extensions`
2. Click the refresh icon (↻) on Claude Model Router
3. Hard-reload claude.ai with `Cmd + Shift + R`

The content script is re-injected on page load, so a page reload is always enough.

---

## Known limitations

- Auto-switch depends on Claude's DOM staying stable. If it breaks, the copy-name button is the fallback.
- Token estimation is heuristic (`max(chars/4, words*1.3)`), not exact. A proper tokenizer (e.g. `tiktoken-wasm`) would be more accurate but adds bundle size.
- Context window usage (conversation length) is not yet tracked.
- No support for Firefox, Safari, or other browsers in MVP.
