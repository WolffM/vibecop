/**
 * Shared Utilities
 *
 * Common helper functions used across modules.
 */

import type { Severity } from "../core/types.js";

// ============================================================================
// Severity Helpers
// ============================================================================

/**
 * Get a severity emoji for visual distinction.
 */
export function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    case "low":
      return "🔵";
    default:
      return "⚪";
  }
}

/**
 * Map severity to SARIF level.
 */
export function severityToSarifLevel(
  severity: Severity,
): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
    default:
      return "warning";
  }
}

// ============================================================================
// Array Helpers
// ============================================================================

/**
 * Group items by a key function.
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

/**
 * Check if two arrays are equal (shallow comparison).
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// Language Detection
// ============================================================================

/** File extension to language mapping (comprehensive for syntax highlighting) */
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  java: "java",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  sh: "bash",
  bash: "bash",
  md: "markdown",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  sql: "sql",
  xml: "xml",
  html: "html",
  css: "css",
};

/** Languages that we track for labeling (subset of all languages) */
const TRACKED_LANGUAGES = new Set([
  "typescript",
  "javascript",
  "python",
  "java",
]);

/**
 * Get language from file extension.
 * @param path - File path to analyze
 * @param forLabeling - If true, only returns tracked languages (typescript/python/java)
 *                      If false, returns syntax highlighting language
 */
export function getLanguageFromPath(
  path: string,
  forLabeling = false,
): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const lang = EXT_TO_LANGUAGE[ext || ""];

  if (!lang) return null;

  if (forLabeling) {
    // For labeling, normalize js to typescript and only return tracked languages
    const normalizedLang = lang === "javascript" ? "typescript" : lang;
    return TRACKED_LANGUAGES.has(normalizedLang) ? normalizedLang : null;
  }

  return lang;
}

/**
 * Map tool name to language for labeling.
 * Returns null for tools that work across languages (semgrep, trunk, jscpd).
 */
export function getToolLanguage(tool: string): string | null {
  const toolLower = tool.toLowerCase();

  // TypeScript/JavaScript tools
  if (["tsc", "eslint", "dependency-cruiser", "knip"].includes(toolLower)) {
    return "typescript";
  }

  // Python tools
  if (["ruff", "mypy", "bandit"].includes(toolLower)) {
    return "python";
  }

  // Java tools
  if (["pmd", "spotbugs"].includes(toolLower)) {
    return "java";
  }

  // Multi-language tools return null
  return null;
}
