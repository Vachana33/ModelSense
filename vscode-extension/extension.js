"use strict";

const vscode = require("vscode");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const { analyze, MODEL_CONFIG, MODEL_ID_TO_KEY } = require("../claude-code-hook/classifier");

// ── Current model polling ──────────────────────────────────────────────────────

function readCurrentModel() {
  const candidates = [
    path.join(os.homedir(), ".claude", "settings.json"),
    path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", ".claude", "settings.json")
  ];
  for (const p of candidates) {
    try {
      const settings = JSON.parse(fs.readFileSync(p, "utf8"));
      const id       = settings.model || "";
      if (MODEL_ID_TO_KEY[id]) return MODEL_ID_TO_KEY[id];
      const lower = id.toLowerCase();
      if (lower.includes("opus"))   return "opus";
      if (lower.includes("sonnet")) return "sonnet";
      if (lower.includes("haiku"))  return "haiku";
    } catch { /* file missing or malformed */ }
  }
  return "sonnet";
}

// ── Sidebar provider ───────────────────────────────────────────────────────────

class SidebarProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._view         = null;
    this._currentModel = readCurrentModel();

    // Poll for model changes every 2 s — same approach as browser extension
    this._pollInterval = setInterval(() => {
      const model = readCurrentModel();
      if (model !== this._currentModel) {
        this._currentModel = model;
        this._postModelUpdate();
      }
    }, 2000);
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "media")
      ]
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "analyze": {
          const result = analyze(msg.prompt, this._currentModel);
          webviewView.webview.postMessage({ type: "result", result, currentModel: this._currentModel });
          break;
        }
        case "copyToClipboard": {
          vscode.env.clipboard.writeText(msg.text).then(() => {
            vscode.window.showInformationMessage(`Copied: ${msg.text}`);
          });
          break;
        }
        case "ready": {
          // Webview just loaded — send current model
          this._postModelUpdate();
          break;
        }
      }
    });
  }

  _postModelUpdate() {
    if (!this._view) return;
    const modelLabel = MODEL_CONFIG[this._currentModel]?.label || this._currentModel;
    this._view.webview.postMessage({
      type: "modelUpdate",
      currentModel: this._currentModel,
      currentModelLabel: modelLabel
    });
  }

  _buildHtml(webview) {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src ${webview.cspSource};">
  <link rel="stylesheet" href="${cssUri}">
  <title>Claude Model Router</title>
</head>
<body>
  <div class="header">
    <span class="title">⚡ Claude Router</span>
    <span class="current-model-badge" id="current-badge">—</span>
  </div>

  <div class="prompt-section">
    <label class="section-label">Your prompt</label>
    <textarea
      id="prompt-input"
      placeholder="Type or paste your prompt here to get a live model recommendation…"
      rows="5"
    ></textarea>
    <button class="btn btn-secondary" id="copy-prompt-btn" style="display:none">
      Copy prompt
    </button>
  </div>

  <div class="result-panel" id="result-panel">
    <div class="idle-msg" id="idle-msg">Start typing to analyze your prompt.</div>

    <div class="analysis" id="analysis" style="display:none">
      <div class="meta-rows">
        <div class="meta-row">
          <span class="meta-label">Task</span>
          <span class="meta-value" id="r-task">—</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Complexity</span>
          <span class="meta-value" id="r-complexity">—</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Tokens</span>
          <span class="meta-value" id="r-tokens">—</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="recommendation" id="recommendation">
        <div class="rec-label">Recommended</div>
        <div class="rec-model" id="r-model">—</div>
        <div class="rec-speed" id="r-speed">—</div>
        <div class="rec-quota" id="r-quota">—</div>
      </div>

      <div class="warning" id="r-warning" style="display:none"></div>

      <div class="divider"></div>

      <div class="command-block" id="command-block" style="display:none">
        <div class="command-label">Run in Claude Code to switch:</div>
        <div class="command-row">
          <code class="command-text" id="r-command">—</code>
          <button class="btn btn-copy" id="copy-cmd-btn">Copy</button>
        </div>
      </div>

      <div class="match-msg" id="match-msg" style="display:none">
        ✓ Current model matches the recommendation.
      </div>

      <div class="reason" id="r-reason">—</div>
    </div>
  </div>

  <script src="${jsUri}"></script>
</body>
</html>`;
  }

  dispose() {
    clearInterval(this._pollInterval);
  }
}

// ── Activation ─────────────────────────────────────────────────────────────────

function activate(context) {
  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("claudeModelRouter.sidebar", provider),

    // Command: open the sidebar
    vscode.commands.registerCommand("claudeModelRouter.openSidebar", () => {
      vscode.commands.executeCommand("claudeModelRouter.sidebar.focus");
    }),

    // Command: analyze selected text (Cmd+Shift+M)
    vscode.commands.registerCommand("claudeModelRouter.analyzeSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selected = editor.document.getText(editor.selection).trim();
      if (!selected) {
        vscode.window.showWarningMessage("Claude Router: No text selected.");
        return;
      }
      // Send selected text to sidebar
      if (provider._view) {
        provider._view.webview.postMessage({ type: "injectPrompt", text: selected });
        vscode.commands.executeCommand("claudeModelRouter.sidebar.focus");
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
