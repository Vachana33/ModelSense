// Runs inside the VS Code webview sandbox — no Node.js, no require.
// Communicates with extension.js via acquireVsCodeApi().

(function () {
  const vscode       = acquireVsCodeApi();
  const promptInput  = document.getElementById("prompt-input");
  const idleMsg      = document.getElementById("idle-msg");
  const analysis     = document.getElementById("analysis");
  const resultPanel  = document.getElementById("result-panel");
  const copyPromptBtn = document.getElementById("copy-prompt-btn");
  const copyCmdBtn   = document.getElementById("copy-cmd-btn");
  const currentBadge = document.getElementById("current-badge");

  let debounceTimer  = null;
  let lastResult     = null;

  // ── Notify extension host that webview is ready ────────────────────────────
  vscode.postMessage({ type: "ready" });

  // ── Live analysis as user types ────────────────────────────────────────────
  promptInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const text = promptInput.value.trim();

    if (!text) {
      showIdle();
      copyPromptBtn.style.display = "none";
      return;
    }

    copyPromptBtn.style.display = "inline-block";

    debounceTimer = setTimeout(() => {
      vscode.postMessage({ type: "analyze", prompt: promptInput.value });
    }, 120);
  });

  // ── Copy prompt button ─────────────────────────────────────────────────────
  copyPromptBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "copyToClipboard", text: promptInput.value });
  });

  // ── Copy /model command button ─────────────────────────────────────────────
  copyCmdBtn.addEventListener("click", () => {
    const cmd = document.getElementById("r-command").textContent;
    if (cmd && cmd !== "—") {
      vscode.postMessage({ type: "copyToClipboard", text: cmd });
    }
  });

  // ── Messages from extension host ───────────────────────────────────────────
  window.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
      case "result":
        lastResult = msg.result;
        renderResult(msg.result, msg.currentModel);
        break;

      case "modelUpdate":
        currentBadge.textContent = msg.currentModelLabel;
        // Re-analyze with new model if there's a prompt
        if (promptInput.value.trim()) {
          vscode.postMessage({ type: "analyze", prompt: promptInput.value });
        }
        break;

      case "injectPrompt":
        // Triggered by Cmd+Shift+M with selected text
        promptInput.value = msg.text;
        promptInput.dispatchEvent(new Event("input"));
        promptInput.focus();
        break;
    }
  });

  // ── Render helpers ─────────────────────────────────────────────────────────

  function showIdle() {
    idleMsg.style.display  = "block";
    analysis.style.display = "none";
    resultPanel.removeAttribute("data-state");
  }

  function renderResult(r, currentModelKey) {
    idleMsg.style.display  = "none";
    analysis.style.display = "block";

    setText("r-task",       r.taskType);
    setText("r-complexity", r.complexityScore > 0
      ? `${r.complexityLabel} (${r.complexityScore}/10)` : "—");
    setText("r-tokens",     r.tokens > 0 ? `~${r.tokens}` : "—");
    setText("r-model",      r.recommendedLabel || "—");
    setText("r-speed",      (r.speedLabel && r.speedLabel !== "—")
      ? `${r.speedLabel} — ${r.speedNote}` : "—");
    setText("r-quota",      r.quotaNote || "—");
    setText("r-reason",     r.reason || "—");

    // Warning
    const warnEl = document.getElementById("r-warning");
    if (r.warning) {
      warnEl.textContent    = `⚠ ${r.warning}`;
      warnEl.style.display  = "block";
    } else {
      warnEl.style.display  = "none";
    }

    // State border
    resultPanel.dataset.state = r.state || "idle";

    // /model command block
    const cmdBlock   = document.getElementById("command-block");
    const matchMsg   = document.getElementById("match-msg");
    const cmdText    = document.getElementById("r-command");
    const modelRank  = { haiku: 0, sonnet: 1, opus: 2 };
    const curRank    = modelRank[currentModelKey] ?? 1;
    const recRank    = modelRank[r.recommendedModel] ?? 1;
    const needSwitch = !r.lowConfidence && r.recommendedModel && r.recommendedModel !== "none"
                       && currentModelKey !== r.recommendedModel;

    if (needSwitch) {
      cmdText.textContent     = `/model ${r.recommendedCmd}`;
      cmdBlock.style.display  = "block";
      matchMsg.style.display  = "none";
    } else if (!r.lowConfidence && r.recommendedModel && r.recommendedModel !== "none") {
      cmdBlock.style.display  = "none";
      matchMsg.style.display  = "block";
    } else {
      cmdBlock.style.display  = "none";
      matchMsg.style.display  = "none";
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
})();
