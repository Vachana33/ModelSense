// Service worker — handles Anthropic API calls on behalf of the content script.
// Keeps the API key out of page context and avoids CSP issues.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "analyzeWithAI") {
    handleAIAnalysis(msg.prompt, msg.apiKey)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err)  => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleAIAnalysis(prompt, apiKey) {
  const systemPrompt =
    "You are a Claude model selector. Analyze the user prompt and return ONLY a valid JSON object — no other text, no markdown, no code fences.";

  const userMessage = `Classify this prompt for Claude model selection:

"""
${prompt}
"""

Return ONLY this JSON (no other text):
{
  "taskType": "architecture|coding_complex|debugging|simple_rewrite|translation|summarization|planning|research|learning|data_extraction|reasoning_deep|unknown",
  "complexityScore": <integer 0-10>,
  "complexityLabel": "Low|Medium|High",
  "recommendedModel": "haiku|sonnet|opus",
  "reason": "<one sentence explaining why this model>",
  "quotaNote": "<one sentence about Opus quota>"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // Strip any accidental markdown fences before parsing
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}
