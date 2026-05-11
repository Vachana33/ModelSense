#!/usr/bin/env node
"use strict";

/**
 * Claude Code UserPromptSubmit hook.
 *
 * Reads the submitted prompt from stdin, classifies it, reads the
 * current model from ~/.claude/settings.json, and prints a model
 * recommendation + the exact /model command to switch if needed.
 *
 * Install: see install.sh or docs/CLAUDE_CODE_HOOK.md
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { analyze, MODEL_CONFIG, MODEL_ID_TO_KEY } = require("./classifier");

// ── Read current model from Claude Code settings ──────────────────────────────

function readCurrentModel() {
  const candidates = [
    path.join(os.homedir(), ".claude", "settings.json"),
    path.join(process.cwd(), ".claude", "settings.json")
  ];

  for (const filePath of candidates) {
    try {
      const raw      = fs.readFileSync(filePath, "utf8");
      const settings = JSON.parse(raw);
      const modelId  = settings.model || "";
      // Try exact match first, then partial match
      if (MODEL_ID_TO_KEY[modelId]) return MODEL_ID_TO_KEY[modelId];
      const lower = modelId.toLowerCase();
      if (lower.includes("opus"))   return "opus";
      if (lower.includes("sonnet")) return "sonnet";
      if (lower.includes("haiku"))  return "haiku";
    } catch {
      // File missing or malformed — try next candidate
    }
  }

  return "sonnet"; // safe default
}

// ── Render output ─────────────────────────────────────────────────────────────

function render(result, currentModelKey) {
  const W = 50;
  const line  = "─".repeat(W);
  const currentLabel = MODEL_CONFIG[currentModelKey]?.label || currentModelKey;

  const lines = [
    "",
    `⚡ Claude Model Router`,
    line,
    `  Task:         ${result.taskType}`,
    `  Complexity:   ${result.complexityLabel} (${result.complexityScore}/10)`,
    `  Tokens:       ~${result.tokens}`,
    `  Current:      ${currentLabel}`,
    line,
    `  Recommended:  ${result.recommendedLabel}`,
    `  Speed:        ${result.speedLabel} — ${result.speedNote}`,
    `  Quota:        ${result.quotaNote}`,
  ];

  if (result.warning) {
    lines.push(line);
    lines.push(`  ⚠  ${result.warning}`);
  }

  lines.push(line);

  if (result.lowConfidence) {
    lines.push(`  ℹ  Not enough signal yet for a confident recommendation.`);
  } else if (result.recommendedModel !== currentModelKey) {
    lines.push(`  To switch before your next prompt, run:`);
    lines.push(`  /model ${result.recommendedCmd}`);
  } else {
    lines.push(`  ✓  Current model matches the recommendation.`);
  }

  lines.push(line);
  lines.push(`  Reason: ${result.reason}`);
  lines.push("");

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  let raw = "";

  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => { raw += chunk; });

  process.stdin.on("end", () => {
    let prompt = "";

    try {
      const payload = JSON.parse(raw);
      // Claude Code passes the prompt under "prompt" key
      prompt = payload.prompt || "";
    } catch {
      // If not JSON (shouldn't happen), treat raw as the prompt
      prompt = raw;
    }

    if (!prompt.trim()) {
      // Empty prompt — nothing to analyse
      process.exit(0);
    }

    const currentModelKey = readCurrentModel();
    const result          = analyze(prompt, currentModelKey);

    process.stdout.write(render(result, currentModelKey));

    // Exit 0 — never block the prompt submission
    process.exit(0);
  });
}

main();
