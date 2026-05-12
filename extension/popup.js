const OPTIONS = ["haiku", "sonnet", "opus"];

function highlightSelected(value) {
  OPTIONS.forEach((m) => {
    document.getElementById(`opt-${m}`)?.classList.toggle("selected", m === value);
  });
}

function updateApiStatus(key) {
  const el = document.getElementById("api-status");
  if (key && key.startsWith("sk-ant-")) {
    el.textContent = "✓ API key set — AI analysis enabled";
    el.className   = "api-status set";
  } else if (key) {
    el.textContent = "⚠ Key saved but format looks unexpected";
    el.className   = "api-status unset";
  } else {
    el.textContent = "Not set — rule-based analysis only";
    el.className   = "api-status unset";
  }
}

// ── Load saved preferences ────────────────────────────────────────────────────

chrome.storage.local.get(["userModel", "anthropicApiKey"], (result) => {
  const model = result.userModel || "sonnet";
  const key   = result.anthropicApiKey || "";

  const radio = document.querySelector(`input[value="${model}"]`);
  if (radio) radio.checked = true;
  highlightSelected(model);

  document.getElementById("api-key-input").value = key;
  updateApiStatus(key);
});

// ── Model selection highlight ─────────────────────────────────────────────────

OPTIONS.forEach((m) => {
  document.getElementById(`opt-${m}`)?.addEventListener("click", () => highlightSelected(m));
});

// ── Show/hide API key ─────────────────────────────────────────────────────────

document.getElementById("toggle-key-btn").addEventListener("click", () => {
  const input = document.getElementById("api-key-input");
  input.type  = input.type === "password" ? "text" : "password";
});

// Update status live as user types
document.getElementById("api-key-input").addEventListener("input", (e) => {
  updateApiStatus(e.target.value);
});

// ── Save ──────────────────────────────────────────────────────────────────────

document.getElementById("save-btn").addEventListener("click", () => {
  const selected = document.querySelector('input[name="model"]:checked');
  const apiKey   = document.getElementById("api-key-input").value.trim();

  chrome.storage.local.set({
    userModel:        selected?.value || "sonnet",
    anthropicApiKey:  apiKey
  }, () => {
    const msg = document.getElementById("saved-msg");
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 1800);
  });
});
