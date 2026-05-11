const OPTIONS = ["haiku", "sonnet", "opus"];

function highlightSelected(value) {
  OPTIONS.forEach((model) => {
    const el = document.getElementById(`opt-${model}`);
    if (el) el.classList.toggle("selected", model === value);
  });
}

// Load saved preference
chrome.storage.local.get(["userModel"], (result) => {
  const saved = result.userModel || "sonnet";
  const radio = document.querySelector(`input[value="${saved}"]`);
  if (radio) radio.checked = true;
  highlightSelected(saved);
});

// Highlight on click
OPTIONS.forEach((model) => {
  const opt = document.getElementById(`opt-${model}`);
  if (opt) {
    opt.addEventListener("click", () => highlightSelected(model));
  }
});

// Save
document.getElementById("save-btn").addEventListener("click", () => {
  const selected = document.querySelector('input[name="model"]:checked');
  if (!selected) return;

  chrome.storage.local.set({ userModel: selected.value }, () => {
    const msg = document.getElementById("saved-msg");
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 1800);
  });
});
