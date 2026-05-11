"use strict";

// ── Model config ──────────────────────────────────────────────────────────────

const MODEL_CONFIG = {
  haiku: {
    label:      "Claude Haiku",
    command:    "claude-haiku-4-5-20251001",
    speedLabel: "Fast",
    speedNote:  "~4x faster than Opus"
  },
  sonnet: {
    label:      "Claude Sonnet",
    command:    "claude-sonnet-4-6",
    speedLabel: "Standard",
    speedNote:  "Good balance of speed and quality"
  },
  opus: {
    label:      "Claude Opus",
    command:    "claude-opus-4-7",
    speedLabel: "Slower",
    speedNote:  "~4x slower than Haiku — worth it for complex tasks"
  }
};

// Map from full Claude Code model IDs back to short keys
const MODEL_ID_TO_KEY = {
  "claude-haiku-4-5-20251001": "haiku",
  "claude-haiku-4-5":          "haiku",
  "claude-sonnet-4-6":         "sonnet",
  "claude-sonnet-4-5":         "sonnet",
  "claude-opus-4-7":           "opus",
  "claude-opus-4-5":           "opus"
};

// ── Task rules ────────────────────────────────────────────────────────────────

const TASK_RULES = [
  {
    type: "architecture",
    keywords: [
      "architecture", "system design", "scalable", "pipeline",
      "orchestration", "multi-agent", "distributed", "microservice",
      "infra", "infrastructure", "event-driven", "service mesh"
    ]
  },
  {
    type: "coding_complex",
    keywords: [
      "refactor", "full stack", "fullstack", "backend", "frontend",
      "database schema", "production", "deploy", "api endpoint",
      "authentication", "authorization", "middleware", "codebase"
    ]
  },
  {
    type: "debugging",
    keywords: [
      "error", "bug", "stack trace", "not working", "exception",
      "crash", "undefined", "null pointer", "traceback", "failing",
      "broken", "throws", "warning", "unexpected"
    ]
  },
  {
    type: "simple_rewrite",
    keywords: [
      "rewrite", "make polite", "improve this email", "shorten",
      "grammar", "rephrase", "paraphrase", "fix my writing",
      "make it sound", "clean up", "proofread"
    ]
  },
  {
    type: "translation",
    keywords: [
      "translate", "übersetzen", "traduction", "into english",
      "into german", "into french", "into spanish", "into japanese",
      "auf deutsch", "en français"
    ]
  },
  {
    type: "summarization",
    keywords: [
      "summarize", "summary", "tldr", "key points", "bullet points",
      "main points", "overview", "condense", "brief summary"
    ]
  },
  {
    type: "planning",
    keywords: [
      "roadmap", "implementation plan", "step by step", "phases",
      "timeline", "milestones", "project plan", "action items",
      "next steps", "breakdown", "sprint"
    ]
  },
  {
    type: "research",
    keywords: [
      "research", "literature", "paper", "sources", "citation",
      "studies", "evidence", "review", "findings", "scholarly",
      "academic", "peer-reviewed"
    ]
  },
  {
    type: "learning",
    keywords: [
      "explain", "teach me", "test me", "beginner", "simple terms",
      "how does", "what is", "what are", "eli5", "help me understand",
      "walk me through", "basics of"
    ]
  },
  {
    type: "data_extraction",
    keywords: [
      "extract", "parse", "json format", "table", "csv", "structured",
      "fields", "pull out", "convert to", "format as", "list all"
    ]
  },
  {
    type: "reasoning_deep",
    keywords: [
      "compare", "tradeoff", "trade-off", "decision", "pros and cons",
      "which is better", "evaluate", "weigh", "assess", "should i",
      "recommend between", "advantages and disadvantages"
    ]
  }
];

// ── Core functions ────────────────────────────────────────────────────────────

function estimateTokens(text) {
  if (!text || !text.trim()) return 0;
  const words     = text.trim().split(/\s+/).filter(Boolean).length;
  const charBased = Math.ceil(text.length / 4);
  const wordBased = Math.ceil(words * 1.3);
  return Math.max(charBased, wordBased);
}

function classifyTask(text) {
  let best = { type: "unknown", score: 0 };

  for (const rule of TASK_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > best.score) best = { type: rule.type, score };
  }

  return best.score >= 2 ? best.type : "unknown";
}

function calculateComplexity(text, tokens, taskType) {
  let score = 0;

  if (tokens < 100)       score += 1;
  else if (tokens < 500)  score += 2;
  else                    score += 3;

  if (text.includes("architecture") || text.includes("system design")) score += 3;
  if (text.includes("debug") || text.includes("error") || text.includes("stack trace")) score += 2;
  if (text.includes("step by step") || text.includes("complete") || text.includes("detailed")) score += 2;
  if (text.includes("tradeoff") || text.includes("trade-off") || text.includes("compare")) score += 2;
  if (text.includes("production") || text.includes("scalable")) score += 2;
  if (text.includes("```")) score += 2;

  if (taskType === "simple_rewrite" || taskType === "translation") {
    score = Math.min(score, 3);
  }

  return Math.min(score, 10);
}

function getComplexityLabel(score) {
  if (score <= 2) return "Low";
  if (score <= 6) return "Medium";
  return "High";
}

function formatTaskType(type) {
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

function recommendModel(taskType, complexityScore) {
  if (["translation", "simple_rewrite"].includes(taskType)) {
    return {
      model:     "haiku",
      reason:    "Simple language task detected. Haiku handles this fast and well.",
      quotaNote: "Save your Opus quota for harder tasks."
    };
  }
  if (taskType === "summarization" && complexityScore <= 4) {
    return {
      model:     "haiku",
      reason:    "Short summarization detected. Haiku is sufficient.",
      quotaNote: "Save your Opus quota."
    };
  }
  if (["architecture", "reasoning_deep"].includes(taskType) || complexityScore >= 8) {
    return {
      model:     "opus",
      reason:    "High-complexity reasoning or architecture task detected.",
      quotaNote: "Use your Opus quota here — this is what it's for."
    };
  }
  if (["debugging", "coding_complex"].includes(taskType) && complexityScore >= 8) {
    return {
      model:     "opus",
      reason:    "Complex coding task detected. Opus may provide deeper reasoning.",
      quotaNote: "Worth using Opus here if the problem is tricky."
    };
  }
  if (complexityScore <= 2) {
    return {
      model:     "haiku",
      reason:    "Low-complexity task detected.",
      quotaNote: "Save your Opus quota."
    };
  }
  if (complexityScore <= 6) {
    return {
      model:     "sonnet",
      reason:    "Medium-complexity task. Sonnet is the best balance.",
      quotaNote: "Good default. Save Opus for heavier tasks."
    };
  }
  return {
    model:     "opus",
    reason:    "High-complexity task detected.",
    quotaNote: "Use your Opus quota here."
  };
}

function computeWarning(currentModelKey, recommendedModel, taskType, tokens) {
  if (tokens > 3000) return "Long prompt. Consider splitting the task.";
  const rank = { haiku: 0, sonnet: 1, opus: 2 };
  const cur  = rank[currentModelKey] ?? 1;
  const rec  = rank[recommendedModel] ?? 1;
  if (cur > rec) return "Current model may be overkill — switch to save quota and get a faster response.";
  if (cur < rec) return "Current model may be too weak for this task — consider switching.";
  if (taskType === "architecture" && currentModelKey !== "opus") {
    return "For deep architecture reasoning, Opus typically produces better results.";
  }
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────────────

function analyze(promptText, currentModelKey) {
  const text        = (promptText || "").toLowerCase();
  const tokens      = estimateTokens(promptText);
  const taskType    = classifyTask(text);
  const complexity  = calculateComplexity(text, tokens, taskType);
  const rec         = recommendModel(taskType, complexity);
  const warning     = computeWarning(currentModelKey, rec.model, taskType, tokens);
  const lowConf     = taskType === "unknown" && tokens < 50;
  const modelCfg    = MODEL_CONFIG[rec.model] || {};

  return {
    taskType:          formatTaskType(taskType),
    complexityScore:   complexity,
    complexityLabel:   getComplexityLabel(complexity),
    recommendedModel:  rec.model,
    recommendedLabel:  modelCfg.label     || rec.model,
    recommendedCmd:    modelCfg.command   || rec.model,
    speedLabel:        modelCfg.speedLabel || "",
    speedNote:         modelCfg.speedNote  || "",
    quotaNote:         rec.quotaNote,
    tokens,
    warning,
    reason: lowConf ? "Not enough signal — type more for a confident recommendation." : rec.reason,
    lowConfidence: lowConf
  };
}

module.exports = { analyze, MODEL_CONFIG, MODEL_ID_TO_KEY };
