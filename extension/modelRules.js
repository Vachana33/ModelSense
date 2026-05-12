const MODEL_CONFIG = {
  haiku: {
    label: "Claude Haiku",
    speedLabel: "Fast",
    speedNote: "~4x faster than Opus"
  },
  sonnet: {
    label: "Claude Sonnet",
    speedLabel: "Standard",
    speedNote: "Good balance of speed and quality"
  },
  opus: {
    label: "Claude Opus",
    speedLabel: "Slower",
    speedNote: "~4x slower than Haiku — worth it for complex tasks"
  }
};

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
      "authentication", "authorization", "middleware", "codebase",
      "rag", "pipeline", "vector", "embedding", "retrieval", "langchain",
      "llm", "ai pipeline", "document", "query", "index"
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
      "main points", "overview", "condense", "brief summary",
      "give me a summary", "what are the main"
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

function recommendModel(taskType, complexityScore) {
  if (["translation", "simple_rewrite"].includes(taskType)) {
    return {
      model: "haiku",
      reason: "Simple language task detected. Haiku handles this fast and well.",
      quotaNote: "Save your Opus quota for harder tasks."
    };
  }

  if (taskType === "summarization" && complexityScore <= 4) {
    return {
      model: "haiku",
      reason: "Short summarization detected. Haiku is sufficient.",
      quotaNote: "Save your Opus quota."
    };
  }

  if (["architecture", "reasoning_deep"].includes(taskType) || complexityScore >= 8) {
    return {
      model: "opus",
      reason: "High-complexity reasoning or architecture task detected.",
      quotaNote: "Use your Opus quota here — this is what it's for."
    };
  }

  if (["debugging", "coding_complex"].includes(taskType) && complexityScore >= 8) {
    return {
      model: "opus",
      reason: "Complex coding task detected. Opus may provide deeper reasoning.",
      quotaNote: "Worth using Opus here if the problem is tricky."
    };
  }

  // coding_complex is always at least Sonnet — "low complexity" just means a short prompt,
  // not that the task itself is simple.
  if (["coding_complex", "debugging"].includes(taskType)) {
    return {
      model: "sonnet",
      reason: "Coding or debugging task detected. Sonnet is the best balance.",
      quotaNote: "Good default. Save Opus for architecture or very complex tasks."
    };
  }

  if (complexityScore <= 2) {
    return {
      model: "haiku",
      reason: "Low-complexity task detected.",
      quotaNote: "Save your Opus quota."
    };
  }

  if (complexityScore <= 6) {
    return {
      model: "sonnet",
      reason: "Medium-complexity task. Sonnet is the best balance.",
      quotaNote: "Good default. Save Opus for heavier tasks."
    };
  }

  return {
    model: "opus",
    reason: "High-complexity task detected.",
    quotaNote: "Use your Opus quota here."
  };
}

function estimateOutputTokens(taskType, inputTokens) {
  switch (taskType) {
    case "translation":       return Math.ceil(inputTokens * 1.2);
    case "simple_rewrite":    return Math.ceil(inputTokens * 1.1);
    case "summarization":     return Math.ceil(inputTokens * 0.5);
    case "debugging":         return 1200;
    case "coding_complex":    return 1500;
    case "architecture":      return 2000;
    case "planning":          return 1600;
    case "reasoning_deep":    return 1400;
    case "research":          return 1800;
    default:                  return 800;
  }
}
