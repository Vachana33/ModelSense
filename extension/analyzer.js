function estimateTokens(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const charBased = Math.ceil(text.length / 4);
  const wordBased = Math.ceil(words * 1.3);
  return Math.max(charBased, wordBased);
}

function classifyTask(text) {
  let bestMatch = { type: "unknown", score: 0 };

  for (const rule of TASK_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > bestMatch.score) {
      bestMatch = { type: rule.type, score };
    }
  }

  // Require at least 2 keyword matches to classify with confidence.
  // A single keyword match (e.g. "error" or "english") is too ambiguous.
  if (bestMatch.score < 2) return "unknown";
  return bestMatch.type;
}

function calculateComplexity(text, inputTokens, taskType) {
  let score = 0;

  if (inputTokens < 100)       score += 1;
  else if (inputTokens < 500)  score += 2;
  else                         score += 3;

  if (text.includes("architecture") || text.includes("system design")) score += 3;
  if (text.includes("debug") || text.includes("error") || text.includes("stack trace")) score += 2;
  if (text.includes("step by step") || text.includes("complete") || text.includes("detailed")) score += 2;
  if (text.includes("tradeoff") || text.includes("trade-off") || text.includes("compare")) score += 2;
  if (text.includes("production") || text.includes("scalable")) score += 2;
  if (text.includes("```")) score += 2;

  // Simple tasks can't score high regardless of length
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

function computeWarning(userModel, recommendedModel, taskType, inputTokens) {
  if (inputTokens > 3000) {
    return "Long prompt detected. Consider splitting the task into smaller parts.";
  }

  const modelRank = { haiku: 0, sonnet: 1, opus: 2 };
  const userRank  = modelRank[userModel]        ?? 1;
  const recRank   = modelRank[recommendedModel] ?? 1;

  if (userRank > recRank) {
    return "Opus may be overkill. You could save your quota and get a faster response.";
  }
  if (userRank < recRank) {
    return "Your current model may be too weak for this task. Consider switching.";
  }
  if (taskType === "architecture" && userModel !== "opus") {
    return "For deep architecture reasoning, Opus typically produces better results.";
  }

  return null;
}

function computeState(userModel, recommendedModel) {
  if (!userModel || userModel === "unknown") return "idle";
  if (userModel === recommendedModel) return "good";
  const modelRank = { haiku: 0, sonnet: 1, opus: 2 };
  return (modelRank[userModel] > modelRank[recommendedModel]) ? "overkill" : "weak";
}

function analyzePrompt(promptText, userModel) {
  const text        = (promptText || "").toLowerCase();
  const inputTokens = estimateTokens(promptText);

  if (!text.trim()) {
    return {
      taskType:            "—",
      complexityScore:     0,
      complexityLabel:     "—",
      recommendedModel:    "none",
      recommendedModelLabel: "—",
      inputTokens:         0,
      speedLabel:          "—",
      speedNote:           "—",
      quotaNote:           "—",
      warning:             null,
      state:               "idle",
      reason:              "Start typing to analyze your prompt."
    };
  }

  const taskType        = classifyTask(text);
  const complexityScore = calculateComplexity(text, inputTokens, taskType);
  const complexityLabel = getComplexityLabel(complexityScore);
  const recommendation  = recommendModel(taskType, complexityScore);
  const warning         = computeWarning(userModel, recommendation.model, taskType, inputTokens);
  const state           = computeState(userModel, recommendation.model);
  const modelCfg        = MODEL_CONFIG[recommendation.model] || {};

  const lowConfidence = taskType === "unknown" && inputTokens < 50;

  return {
    taskType:             formatTaskType(taskType),
    complexityScore,
    complexityLabel,
    recommendedModel:     recommendation.model,
    recommendedModelLabel: modelCfg.label || "—",
    inputTokens,
    speedLabel:           modelCfg.speedLabel || "—",
    speedNote:            modelCfg.speedNote  || "—",
    quotaNote:            recommendation.quotaNote,
    warning,
    state:                lowConfidence ? "idle" : state,
    reason:               lowConfidence
      ? "Type more to get a confident recommendation."
      : recommendation.reason
  };
}
