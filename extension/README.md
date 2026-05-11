# Claude Model Router

A Chrome extension that analyzes your prompt on claude.ai and recommends the right Claude model before you send — so you preserve your Opus quota and get faster responses on simple tasks.

## What it does

- Classifies your prompt into a task type (coding, architecture, rewriting, etc.)
- Scores complexity from 0–10
- Recommends Haiku, Sonnet, or Opus with a reason
- Shows response speed: Fast / Standard / Slower
- Warns if you're using Opus on a simple task (quota waste) or Haiku on a complex one
- Runs entirely in your browser — no data is sent anywhere

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Open `claude.ai` — the overlay appears top-right

## Set your current model

Click the extension icon in the Chrome toolbar.
Select whichever model you currently have active in Claude.
Click **Save**.

The overlay will now warn you when your selected model is overkill or too weak for the task.

## File structure

```
extension/
├── manifest.json     Chrome extension config (Manifest V3)
├── content.js        Injects overlay, watches prompt input
├── analyzer.js       Token estimation, task classification, complexity scoring
├── modelRules.js     Model config, task rules, recommendation logic
├── overlay.css       Floating panel styles
├── popup.html        Extension popup UI
├── popup.js          Popup logic (save model preference)
├── storage.js        Thin chrome.storage.local wrapper
└── icons/            Extension icons (16, 48, 128px)
```

## Privacy

All analysis runs locally in your browser using rule-based keyword matching.
No prompt text is ever sent to any server.
Only your model preference is stored (in `chrome.storage.local`).
