// ── State ─────────────────────────────────────────────────────────────────────

let currentInputElement = null;
let currentUserModel    = "sonnet"; // fallback until storage + DOM detection runs
let lastPromptText      = "";
let debounceTimer       = null;
let switchFeedbackTimer = null;

const MODEL_COMMANDS = {
  haiku:  "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus:   "claude-opus-4-7"
};

// ── Storage: load saved preference, then DOM detection takes priority ─────────

chrome.storage.local.get(["userModel"], (result) => {
  if (result.userModel) currentUserModel = result.userModel;
});

// Re-sync when user changes model in popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.userModel) {
    currentUserModel = changes.userModel.newValue;
    reanalyze();
  }
});

// ── DOM: detect which model Claude currently has selected ─────────────────────

function detectCurrentModelFromDOM() {
  const input = findPromptInput();

  // Walk up from the input element and scan nearby buttons for model names.
  // Short text filter (<60 chars) avoids matching conversation content
  // that might mention model names.
  let container = input ? input.parentElement : document.body;

  for (let depth = 0; depth < 10; depth++) {
    if (!container) break;
    const buttons = container.querySelectorAll("button");
    for (const btn of buttons) {
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

// Poll every 2 s — picks up model changes the user makes through Claude's own UI
setInterval(refreshCurrentModel, 2000);

// ── Auto-switch ───────────────────────────────────────────────────────────────

async function attemptAutoSwitch(targetModel) {
  const targetLabel = { haiku: "haiku", sonnet: "sonnet", opus: "opus" }[targetModel];
  if (!targetLabel) return false;

  setSwitchFeedback("Searching for model selector…", "info");

  // Step 1: find and click the button that opens the model picker
  const pickerBtn = findModelPickerButton();
  if (!pickerBtn) {
    setSwitchFeedback("Could not find model selector — switch manually.", "error");
    return false;
  }

  pickerBtn.click();
  await sleep(350);

  // Step 2: find the target option in the now-open dropdown
  const allClickable = document.querySelectorAll(
    'button, [role="option"], [role="menuitem"], [role="radio"], li'
  );

  for (const el of allClickable) {
    const text = el.textContent.toLowerCase().trim();
    if (text.length > 80) continue;
    if (text.includes(targetLabel)) {
      el.click();
      await sleep(200);
      setSwitchFeedback(`Switched to ${MODEL_CONFIG[targetModel]?.label} ✓`, "success");
      currentUserModel = targetModel;
      chrome.storage.local.set({ userModel: targetModel });
      reanalyze();
      return true;
    }
  }

  // Close the dropdown if target wasn't found
  document.body.click();
  setSwitchFeedback("Auto-switch failed — switch manually.", "error");
  return false;
}

function findModelPickerButton() {
  // Prefer buttons with relevant aria-labels or data-testid attributes
  const ariaTargets = document.querySelectorAll(
    '[data-testid*="model"], [data-testid*="Model"], ' +
    'button[aria-label*="model"], button[aria-label*="Model"], ' +
    'button[aria-label*="Claude"]'
  );
  if (ariaTargets.length > 0) return ariaTargets[0];

  // Fall back to walking up from the input and finding a short button with a model name
  const input = findPromptInput();
  let container = input ? input.parentElement : null;

  for (let depth = 0; depth < 10; depth++) {
    if (!container) break;
    const buttons = container.querySelectorAll("button");
    for (const btn of buttons) {
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
  el.textContent = message;
  el.dataset.type = type; // "info" | "success" | "error"
  el.style.display = "block";

  clearTimeout(switchFeedbackTimer);
  if (type === "success" || type === "error") {
    switchFeedbackTimer = setTimeout(() => {
      el.style.display = "none";
    }, 3000);
  }
}

// ── Copy fallback ─────────────────────────────────────────────────────────────

function copyModelName(modelLabel) {
  navigator.clipboard.writeText(modelLabel).then(() => {
    setSwitchFeedback(`"${modelLabel}" copied to clipboard`, "success");
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
      <button class="cmr-toggle" id="cmr-toggle" title="Collapse">−</button>
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
        <button class="cmr-btn cmr-btn-copy" id="cmr-copy-btn" title="Copy model name to clipboard">Copy</button>
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

function updateOverlay(a) {
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

  // Current model row — prefer DOM detection, show "unknown" if neither source works
  const displayedModel = MODEL_CONFIG[currentUserModel]?.label || currentUserModel || "Unknown";
  setText("cmr-current-model", displayedModel);

  // Warning
  const warnEl = document.getElementById("cmr-warning");
  if (warnEl) {
    warnEl.textContent  = a.warning ? `⚠ ${a.warning}` : "";
    warnEl.style.display = a.warning ? "block" : "none";
  }

  // Action buttons — show only when there is an actionable recommendation
  const actionsEl  = document.getElementById("cmr-actions");
  const switchBtn  = document.getElementById("cmr-switch-btn");
  const copyBtn    = document.getElementById("cmr-copy-btn");

  const hasRecommendation = a.recommendedModel && a.recommendedModel !== "none" && a.state !== "idle";

  if (actionsEl) actionsEl.style.display = hasRecommendation ? "flex" : "none";

  if (hasRecommendation && switchBtn && copyBtn) {
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

// ── Prompt detection ──────────────────────────────────────────────────────────

function findPromptInput() {
  // Claude uses ProseMirror contenteditable — target it specifically first
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
      // Reset to idle when input is cleared (prompt was sent)
      if (!text.trim() && lastPromptText.trim()) {
        lastPromptText = "";
        updateOverlay(emptyAnalysis());
        return;
      }
      lastPromptText = text;
      handlePromptChange(text);
    }, 120);
  });

  handlePromptChange(getInputText(input));
}

function handlePromptChange(promptText) {
  const analysis = analyzePrompt(promptText, currentUserModel);
  updateOverlay(analysis);
}

function reanalyze() {
  if (currentInputElement) {
    handlePromptChange(getInputText(currentInputElement));
  }
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Boot ──────────────────────────────────────────────────────────────────────

createOverlay();

const observer = new MutationObserver(() => {
  attachInputListenerIfNeeded();
  if (!document.getElementById("cmr-overlay")) createOverlay();
});

observer.observe(document.body, { childList: true, subtree: true });

// Fallback interval — catches cases the observer misses
setInterval(attachInputListenerIfNeeded, 1500);
