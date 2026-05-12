// ── State ─────────────────────────────────────────────────────────────────────

let currentInputElement = null;
let currentUserModel    = "sonnet";
let anthropicApiKey     = "";
let lastPromptText      = "";
let debounceTimer       = null;
let aiDebounceTimer     = null;
let switchFeedbackTimer = null;

// ── Storage: load preferences ─────────────────────────────────────────────────

chrome.storage.local.get(["userModel", "anthropicApiKey"], (result) => {
  if (result.userModel)       currentUserModel  = result.userModel;
  if (result.anthropicApiKey) anthropicApiKey   = result.anthropicApiKey;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.userModel)       currentUserModel = changes.userModel.newValue;
  if (changes.anthropicApiKey) anthropicApiKey  = changes.anthropicApiKey.newValue;
  reanalyze();
});

// ── DOM: detect current model from Claude's UI ────────────────────────────────

function detectCurrentModelFromDOM() {
  const input = findPromptInput();
  let container = input ? input.parentElement : document.body;

  for (let depth = 0; depth < 10; depth++) {
    if (!container) break;
    for (const btn of container.querySelectorAll("button")) {
      const text = btn.textContent.toLowerCase().trim();
      if (text.length > 60) continue;
      if (text.includes("opus"))   return "opus";
      if (text.includes("sonnet")) return "sonnet";
      if (text.includes("haiku"))  return "haiku";
    }
    container = container.parentElement;
  }
  return null;
}

function refreshCurrentModel() {
  const domModel = detectCurrentModelFromDOM();
  if (domModel && domModel !== currentUserModel) {
    currentUserModel = domModel;
    reanalyze();
  }
}

setInterval(refreshCurrentModel, 2000);

// ── Auto-switch ───────────────────────────────────────────────────────────────

async function attemptAutoSwitch(targetModel) {
  setSwitchFeedback("Searching for model selector…", "info");
  const pickerBtn = findModelPickerButton();
  if (!pickerBtn) {
    setSwitchFeedback("Could not find model selector — switch manually.", "error");
    return;
  }
  pickerBtn.click();
  await sleep(350);

  const targetLabel = { haiku: "haiku", sonnet: "sonnet", opus: "opus" }[targetModel];
  const candidates  = document.querySelectorAll(
    'button, [role="option"], [role="menuitem"], [role="radio"], li'
  );
  for (const el of candidates) {
    const text = el.textContent.toLowerCase().trim();
    if (text.length > 80 || !text.includes(targetLabel)) continue;
    el.click();
    await sleep(200);
    setSwitchFeedback(`Switched to ${MODEL_CONFIG[targetModel]?.label} ✓`, "success");
    currentUserModel = targetModel;
    chrome.storage.local.set({ userModel: targetModel });
    reanalyze();
    return;
  }
  document.body.click();
  setSwitchFeedback("Auto-switch failed — switch manually.", "error");
}

function findModelPickerButton() {
  const ariaTargets = document.querySelectorAll(
    '[data-testid*="model"], [data-testid*="Model"], ' +
    'button[aria-label*="model"], button[aria-label*="Model"], button[aria-label*="Claude"]'
  );
  if (ariaTargets.length > 0) return ariaTargets[0];

  const input = findPromptInput();
  let container = input ? input.parentElement : null;
  for (let d = 0; d < 10; d++) {
    if (!container) break;
    for (const btn of container.querySelectorAll("button")) {
      const text = btn.textContent.toLowerCase().trim();
      if (text.length < 60 &&
          (text.includes("opus") || text.includes("sonnet") || text.includes("haiku"))) {
        return btn;
      }
    }
    container = container.parentElement;
  }
  return null;
}

function setSwitchFeedback(message, type) {
  const el = document.getElementById("cmr-switch-feedback");
  if (!el) return;
  el.textContent   = message;
  el.dataset.type  = type;
  el.style.display = "block";
  clearTimeout(switchFeedbackTimer);
  if (type === "success" || type === "error") {
    switchFeedbackTimer = setTimeout(() => { el.style.display = "none"; }, 3000);
  }
}

// ── Clipboard copy ────────────────────────────────────────────────────────────

function copyModelName(modelLabel) {
  navigator.clipboard.writeText(modelLabel).then(() => {
    setSwitchFeedback(`"${modelLabel}" copied`, "success");
  }).catch(() => {
    setSwitchFeedback(`Select: ${modelLabel}`, "info");
  });
}

// ── Overlay creation ──────────────────────────────────────────────────────────

function createOverlay() {
  if (document.getElementById("cmr-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "cmr-overlay";
  overlay.dataset.state = "idle";
  overlay.innerHTML = `
    <div class="cmr-header">
      <span class="cmr-title">⚡ Claude Router</span>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="cmr-ai-badge" id="cmr-ai-badge" style="display:none">AI</span>
        <button class="cmr-toggle" id="cmr-toggle" title="Collapse">−</button>
      </div>
    </div>
    <div class="cmr-body" id="cmr-body">
      <div class="cmr-row">
        <span class="cmr-label">Task</span>
        <span class="cmr-value" id="cmr-task-val">—</span>
      </div>
      <div class="cmr-row">
        <span class="cmr-label">Complexity</span>
        <span class="cmr-value" id="cmr-complexity-val">—</span>
      </div>
      <div class="cmr-row">
        <span class="cmr-label">Current model</span>
        <span class="cmr-value cmr-current-model" id="cmr-current-model">—</span>
      </div>
      <div class="cmr-divider"></div>
      <div class="cmr-model-block">
        <div class="cmr-model-label">Recommended</div>
        <div class="cmr-model-name" id="cmr-model-name">—</div>
        <div class="cmr-speed" id="cmr-speed">—</div>
      </div>
      <div class="cmr-divider"></div>
      <div class="cmr-quota" id="cmr-quota">—</div>
      <div class="cmr-tokens" id="cmr-tokens">Input tokens: —</div>
      <div class="cmr-warning" id="cmr-warning"></div>
      <div class="cmr-actions" id="cmr-actions">
        <button class="cmr-btn cmr-btn-switch" id="cmr-switch-btn">Switch to —</button>
        <button class="cmr-btn cmr-btn-copy"   id="cmr-copy-btn" title="Copy model name">Copy</button>
      </div>
      <div class="cmr-switch-feedback" id="cmr-switch-feedback"></div>
      <div class="cmr-reason" id="cmr-reason">Start typing to analyze your prompt.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("cmr-toggle").addEventListener("click", toggleOverlay);
}

function toggleOverlay() {
  const body = document.getElementById("cmr-body");
  const btn  = document.getElementById("cmr-toggle");
  if (!body) return;
  const collapsed = body.style.display === "none";
  body.style.display = collapsed ? "block" : "none";
  btn.textContent    = collapsed ? "−" : "+";
  btn.title          = collapsed ? "Collapse" : "Expand";
}

// ── Overlay update ────────────────────────────────────────────────────────────

function updateOverlay(a, isAI = false) {
  const overlay = document.getElementById("cmr-overlay");
  if (!overlay) return;

  overlay.dataset.state = a.state;

  setText("cmr-task-val",       a.taskType);
  setText("cmr-complexity-val", a.complexityScore > 0
    ? `${a.complexityLabel} (${a.complexityScore}/10)` : "—");
  setText("cmr-model-name",     a.recommendedModelLabel);
  setText("cmr-speed",          a.speedLabel !== "—"
    ? `${a.speedLabel} — ${a.speedNote}` : "—");
  setText("cmr-quota",          a.quotaNote);
  setText("cmr-tokens",         a.inputTokens > 0
    ? `Input tokens: ~${a.inputTokens}` : "Input tokens: —");
  setText("cmr-current-model",  MODEL_CONFIG[currentUserModel]?.label || currentUserModel || "—");

  // AI badge
  const badge = document.getElementById("cmr-ai-badge");
  if (badge) badge.style.display = isAI ? "inline-block" : "none";

  // Warning
  const warnEl = document.getElementById("cmr-warning");
  if (warnEl) {
    warnEl.textContent   = a.warning ? `⚠ ${a.warning}` : "";
    warnEl.style.display = a.warning ? "block" : "none";
  }

  // Action buttons
  const actionsEl = document.getElementById("cmr-actions");
  const switchBtn = document.getElementById("cmr-switch-btn");
  const copyBtn   = document.getElementById("cmr-copy-btn");
  const hasRec    = a.recommendedModel && a.recommendedModel !== "none" && a.state !== "idle";

  if (actionsEl) actionsEl.style.display = hasRec ? "flex" : "none";
  if (hasRec && switchBtn && copyBtn) {
    switchBtn.textContent = `Switch to ${a.recommendedModelLabel}`;
    switchBtn.onclick = () => attemptAutoSwitch(a.recommendedModel);
    copyBtn.onclick   = () => copyModelName(a.recommendedModelLabel);
  }

  setText("cmr-reason", a.reason);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Hybrid analysis: rules now, AI after 600 ms pause ────────────────────────

function handlePromptChange(promptText) {
  // 1. Show rule-based result immediately
  const ruleResult = analyzePrompt(promptText, currentUserModel);
  updateOverlay(ruleResult, false);

  // 2. If API key exists and prompt is non-trivial, queue AI refinement
  clearTimeout(aiDebounceTimer);
  if (anthropicApiKey && promptText.trim().length > 20) {
    aiDebounceTimer = setTimeout(() => {
      chrome.runtime.sendMessage(
        { type: "analyzeWithAI", prompt: promptText, apiKey: anthropicApiKey },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok) return; // silent fallback
          const ai     = response.result;
          const merged = mergeAIResult(ruleResult, ai, promptText);
          updateOverlay(merged, true);
        }
      );
    }, 600);
  }
}

function mergeAIResult(ruleBase, ai, promptText) {
  // AI provides task, complexity, recommendation, reason, quotaNote.
  // We keep ruleBase's token count and warning logic since AI doesn't compute those.
  const modelCfg = MODEL_CONFIG[ai.recommendedModel] || MODEL_CONFIG[ruleBase.recommendedModel] || {};
  const modelRank = { haiku: 0, sonnet: 1, opus: 2 };
  const userRank  = modelRank[currentUserModel]    ?? 1;
  const recRank   = modelRank[ai.recommendedModel] ?? 1;

  let state = "idle";
  if (ai.recommendedModel && ai.recommendedModel !== "none") {
    if (userRank === recRank)      state = "good";
    else if (userRank > recRank)   state = "overkill";
    else                           state = "weak";
  }

  return {
    taskType:             formatAITaskType(ai.taskType),
    complexityScore:      ai.complexityScore      || ruleBase.complexityScore,
    complexityLabel:      ai.complexityLabel      || ruleBase.complexityLabel,
    recommendedModel:     ai.recommendedModel     || ruleBase.recommendedModel,
    recommendedModelLabel: modelCfg.label         || ruleBase.recommendedModelLabel,
    inputTokens:          ruleBase.inputTokens,
    speedLabel:           modelCfg.speedLabel     || ruleBase.speedLabel,
    speedNote:            modelCfg.speedNote      || ruleBase.speedNote,
    quotaNote:            ai.quotaNote            || ruleBase.quotaNote,
    warning:              ruleBase.warning,        // keep rule-based warning logic
    state,
    reason:               ai.reason               || ruleBase.reason
  };
}

function formatAITaskType(type) {
  const labels = {
    architecture:    "Architecture / System Design",
    coding_complex:  "Complex Coding",
    debugging:       "Debugging",
    simple_rewrite:  "Writing / Rewriting",
    translation:     "Translation",
    summarization:   "Summarization",
    planning:        "Planning",
    research:        "Research",
    learning:        "Learning / Explanation",
    data_extraction: "Data Extraction",
    reasoning_deep:  "Deep Reasoning",
    unknown:         "General"
  };
  return labels[type] || type;
}

// ── Prompt detection ──────────────────────────────────────────────────────────

function findPromptInput() {
  return (
    document.querySelector('[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]')              ||
    document.querySelector("textarea")                                  ||
    document.querySelector('[role="textbox"]')
  );
}

function getInputText(input) {
  if (!input) return "";
  if (input.tagName === "TEXTAREA") return input.value || "";
  return input.innerText || input.textContent || "";
}

function attachInputListenerIfNeeded() {
  const input = findPromptInput();
  if (!input || input === currentInputElement) return;
  currentInputElement = input;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const text = getInputText(input);
      if (!text.trim() && lastPromptText.trim()) {
        lastPromptText = "";
        updateOverlay(emptyAnalysis(), false);
        return;
      }
      lastPromptText = text;
      handlePromptChange(text);
    }, 120);
  });

  handlePromptChange(getInputText(input));
}

function reanalyze() {
  if (currentInputElement) handlePromptChange(getInputText(currentInputElement));
}

function emptyAnalysis() {
  return {
    taskType: "—", complexityScore: 0, complexityLabel: "—",
    recommendedModel: "none", recommendedModelLabel: "—",
    inputTokens: 0, speedLabel: "—", speedNote: "—",
    quotaNote: "—", warning: null, state: "idle",
    reason: "Start typing to analyze your prompt."
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Boot ──────────────────────────────────────────────────────────────────────

createOverlay();

const observer = new MutationObserver(() => {
  attachInputListenerIfNeeded();
  if (!document.getElementById("cmr-overlay")) createOverlay();
});
observer.observe(document.body, { childList: true, subtree: true });
setInterval(attachInputListenerIfNeeded, 1500);
