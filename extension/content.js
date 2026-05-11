let currentInputElement = null;
let currentUserModel    = "sonnet"; // safe default until storage loads
let debounceTimer       = null;

// Load the user's saved model preference
chrome.storage.local.get(["userModel"], (result) => {
  if (result.userModel) currentUserModel = result.userModel;
});

// Re-sync when the user changes the model in the popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.userModel) {
    currentUserModel = changes.userModel.newValue;
    // Re-run analysis with the new model setting
    if (currentInputElement) {
      handlePromptChange(getInputText(currentInputElement));
    }
  }
});

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
      <div class="cmr-row" id="cmr-task">
        <span class="cmr-label">Task</span>
        <span class="cmr-value" id="cmr-task-val">—</span>
      </div>
      <div class="cmr-row" id="cmr-complexity-row">
        <span class="cmr-label">Complexity</span>
        <span class="cmr-value" id="cmr-complexity-val">—</span>
      </div>
      <div class="cmr-divider"></div>
      <div class="cmr-model-block" id="cmr-model-block">
        <div class="cmr-model-label">Recommended</div>
        <div class="cmr-model-name" id="cmr-model-name">—</div>
        <div class="cmr-speed" id="cmr-speed">—</div>
      </div>
      <div class="cmr-divider"></div>
      <div class="cmr-quota" id="cmr-quota">—</div>
      <div class="cmr-tokens" id="cmr-tokens">Input tokens: —</div>
      <div class="cmr-warning" id="cmr-warning"></div>
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
  body.style.display  = collapsed ? "block" : "none";
  btn.textContent     = collapsed ? "−" : "+";
  btn.title           = collapsed ? "Collapse" : "Expand";
}

// ── Overlay update ────────────────────────────────────────────────────────────

function updateOverlay(a) {
  const overlay = document.getElementById("cmr-overlay");
  if (!overlay) return;

  overlay.dataset.state = a.state;

  setText("cmr-task-val",       a.taskType);
  setText("cmr-complexity-val", a.complexityScore > 0
    ? `${a.complexityLabel} (${a.complexityScore}/10)`
    : "—");
  setText("cmr-model-name",     a.recommendedModelLabel);
  setText("cmr-speed",          a.speedLabel !== "—"
    ? `${a.speedLabel} — ${a.speedNote}`
    : "—");
  setText("cmr-quota",          a.quotaNote);
  setText("cmr-tokens",         a.inputTokens > 0
    ? `Input tokens: ~${a.inputTokens}`
    : "Input tokens: —");
  setText("cmr-warning",        a.warning ? `⚠ ${a.warning}` : "");
  setText("cmr-reason",         a.reason);

  // Show/hide warning element
  const warnEl = document.getElementById("cmr-warning");
  if (warnEl) warnEl.style.display = a.warning ? "block" : "none";
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
    document.querySelector('textarea')                                  ||
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
      handlePromptChange(getInputText(input));
    }, 120); // slight debounce so it doesn't fire on every keystroke
  });

  // Run once immediately in case there's already text
  handlePromptChange(getInputText(input));
}

function handlePromptChange(promptText) {
  const analysis = analyzePrompt(promptText, currentUserModel);
  updateOverlay(analysis);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

createOverlay();

// Watch for DOM changes (Claude is a SPA — input may not exist on first load)
const observer = new MutationObserver(() => {
  attachInputListenerIfNeeded();
  if (!document.getElementById("cmr-overlay")) createOverlay();
});

observer.observe(document.body, { childList: true, subtree: true });

// Interval fallback for edge cases
setInterval(attachInputListenerIfNeeded, 1500);
