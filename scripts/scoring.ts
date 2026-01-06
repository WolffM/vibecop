/**
 * Scoring Module
 *
 * Maps tool-specific outputs to normalized severity, confidence, and effort scores.
 *
 * Reference: vibeCop_spec.md section 7
 */

import type {
  AutofixLevel,
  Confidence,
  Effort,
  Layer,
  Severity,
  ToolName,
} from "./types.js";

// ============================================================================
// Severity Mapping
// ============================================================================

/**
 * Severity hierarchy (for comparisons).
 * Higher number = more severe.
 * 'info' is added as level 0 for threshold purposes (accepts all severities).
 */
export const SEVERITY_ORDER: Record<Severity | "info", number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Compare severities. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

/**
 * Check if severity meets threshold.
 * Accepts 'info' as threshold to allow all severities.
 */
export function meetsSeverityThreshold(
  severity: Severity,
  threshold: Severity | "info",
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

// ============================================================================
// Confidence Mapping
// ============================================================================

/**
 * Confidence hierarchy (for comparisons).
 */
export const CONFIDENCE_ORDER: Record<Confidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Compare confidence levels.
 */
export function compareConfidence(a: Confidence, b: Confidence): number {
  return CONFIDENCE_ORDER[a] - CONFIDENCE_ORDER[b];
}

/**
 * Check if confidence meets threshold.
 */
export function meetsConfidenceThreshold(
  confidence: Confidence,
  threshold: Confidence,
): boolean {
  return CONFIDENCE_ORDER[confidence] >= CONFIDENCE_ORDER[threshold];
}

// ============================================================================
// Tool-Specific Severity Mappings
// ============================================================================

/**
 * Map ESLint severity (0=off, 1=warn, 2=error) to our severity scale.
 */
export function mapEslintSeverity(eslintSeverity: 0 | 1 | 2): Severity {
  switch (eslintSeverity) {
    case 2:
      return "high";
    case 1:
      return "medium";
    default:
      return "low";
  }
}

/**
 * Map ESLint rules to confidence level.
 * Some rules are very reliable (high), others are heuristic (medium/low).
 */
export function mapEslintConfidence(ruleId: string): Confidence {
  // High confidence rules (type-related, definite bugs)
  const highConfidenceRules = [
    "no-undef",
    "no-unused-vars",
    "@typescript-eslint/no-unused-vars",
    "no-dupe-keys",
    "no-duplicate-case",
    "no-unreachable",
    "no-func-assign",
    "no-import-assign",
    "no-const-assign",
    "constructor-super",
    "getter-return",
    "no-class-assign",
    "no-compare-neg-zero",
    "no-cond-assign",
    "no-constant-condition",
    "no-debugger",
    "no-dupe-args",
    "no-dupe-class-members",
    "no-empty-pattern",
    "no-ex-assign",
    "no-fallthrough",
    "no-invalid-regexp",
    "no-obj-calls",
    "no-self-assign",
    "no-setter-return",
    "no-sparse-arrays",
    "no-this-before-super",
    "no-unsafe-negation",
    "use-isnan",
    "valid-typeof",
  ];

  if (highConfidenceRules.includes(ruleId)) {
    return "high";
  }

  // Medium confidence rules (likely issues but context-dependent)
  const mediumConfidenceRules = [
    "eqeqeq",
    "no-eval",
    "no-implied-eval",
    "no-new-func",
    "no-shadow",
    "no-use-before-define",
    "prefer-const",
    "no-var",
    "complexity",
    "max-depth",
    "max-lines-per-function",
  ];

  if (mediumConfidenceRules.includes(ruleId)) {
    return "medium";
  }

  // Default: stylistic/preference rules
  return "low";
}

/**
 * Map TypeScript compiler errors to severity.
 * All tsc errors are considered high severity (they prevent compilation).
 */
export function mapTscSeverity(_code: number): Severity {
  // All TypeScript errors are high severity
  return "high";
}

/**
 * Map TypeScript errors to confidence.
 * TypeScript errors are definitionally high confidence.
 */
export function mapTscConfidence(_code: number): Confidence {
  return "high";
}

/**
 * Map jscpd (duplicate code) findings to severity.
 * Based on the size of duplication.
 */
export function mapJscpdSeverity(lines: number, tokens: number): Severity {
  // Large duplications are high severity
  if (lines >= 50 || tokens >= 500) {
    return "high";
  }
  // Medium-sized duplications
  if (lines >= 20 || tokens >= 200) {
    return "medium";
  }
  // Small duplications
  return "low";
}

/**
 * Map jscpd findings to confidence.
 * Exact/near-exact duplicates are high confidence.
 */
export function mapJscpdConfidence(_tokens: number): Confidence {
  // jscpd finds exact duplicates, always high confidence
  return "high";
}

/**
 * Map dependency-cruiser violations to severity.
 */
export function mapDepcruiseSeverity(violationType: string): Severity {
  // Forbidden dependencies are high
  if (violationType === "not-allowed" || violationType === "forbidden") {
    return "high";
  }
  // Circular dependencies are high
  if (violationType === "cycle") {
    return "high";
  }
  // Orphans, unreachable
  if (violationType === "orphan" || violationType === "reachable") {
    return "medium";
  }
  return "medium";
}

/**
 * Map dependency-cruiser findings to confidence.
 */
export function mapDepcruiseConfidence(violationType: string): Confidence {
  // Cycles and forbidden deps are definitive
  if (
    violationType === "cycle" ||
    violationType === "not-allowed" ||
    violationType === "forbidden"
  ) {
    return "high";
  }
  return "medium";
}

/**
 * Map knip (unused code) findings to severity.
 */
export function mapKnipSeverity(issueType: string): Severity {
  // Unused dependencies are high (bloat, security)
  if (issueType === "dependencies" || issueType === "devDependencies") {
    return "high";
  }
  // Unused exports are medium
  if (issueType === "exports" || issueType === "types") {
    return "medium";
  }
  // Unused files are medium-high
  if (issueType === "files") {
    return "medium";
  }
  return "medium";
}

/**
 * Map knip findings to confidence.
 */
export function mapKnipConfidence(issueType: string): Confidence {
  // Dependencies are high confidence
  if (issueType === "dependencies" || issueType === "devDependencies") {
    return "high";
  }
  // Exports can have false positives (dynamic usage)
  if (issueType === "exports") {
    return "medium";
  }
  // Unused files are usually accurate
  if (issueType === "files") {
    return "high";
  }
  return "medium";
}

/**
 * Map semgrep findings to severity.
 * Uses semgrep's own severity when available.
 */
export function mapSemgrepSeverity(semgrepSeverity: string): Severity {
  const normalized = semgrepSeverity.toLowerCase();
  if (normalized === "error" || normalized === "high") {
    return "high";
  }
  if (normalized === "warning" || normalized === "medium") {
    return "medium";
  }
  if (normalized === "info" || normalized === "low") {
    return "low";
  }
  return "medium"; // conservative default
}

/**
 * Map semgrep findings to confidence.
 */
export function mapSemgrepConfidence(semgrepConfidence?: string): Confidence {
  if (!semgrepConfidence) {
    return "medium";
  }
  const normalized = semgrepConfidence.toLowerCase();
  if (normalized === "high") {
    return "high";
  }
  if (normalized === "medium") {
    return "medium";
  }
  return "low";
}

// ============================================================================
// Python Tool Mappings
// ============================================================================

/**
 * Map Ruff severity codes to our severity scale.
 * Ruff uses single-letter prefixes: E=error, W=warning, F=pyflakes, etc.
 */
export function mapRuffSeverity(code: string): Severity {
  // E9xx are syntax errors (critical)
  if (code.match(/^E9\d{2}/)) {
    return "critical";
  }
  // F8xx are undefined names, F4xx are import issues (high)
  if (code.match(/^F[48]\d{2}/)) {
    return "high";
  }
  // E (errors) and F (pyflakes) are typically high
  if (code.startsWith("E") || code.startsWith("F")) {
    return "high";
  }
  // S (bandit/security) rules are high to critical
  if (code.startsWith("S")) {
    return "high";
  }
  // W (warnings) are medium
  if (code.startsWith("W")) {
    return "medium";
  }
  // C (complexity), N (naming), D (docstrings) are low
  if (code.startsWith("C") || code.startsWith("N") || code.startsWith("D")) {
    return "low";
  }
  // B (bugbear) rules are medium to high
  if (code.startsWith("B")) {
    return "medium";
  }
  return "medium";
}

/**
 * Map Ruff findings to confidence.
 */
export function mapRuffConfidence(code: string): Confidence {
  // Syntax errors are definite
  if (code.match(/^E9\d{2}/)) {
    return "high";
  }
  // Undefined names, unused imports are definite
  if (code.match(/^F[48]\d{2}/)) {
    return "high";
  }
  // Security rules (S) can have false positives
  if (code.startsWith("S")) {
    return "medium";
  }
  // Most E/F rules are reliable
  if (code.startsWith("E") || code.startsWith("F")) {
    return "high";
  }
  // Style rules are preference-based
  if (code.startsWith("N") || code.startsWith("D")) {
    return "low";
  }
  return "medium";
}

/**
 * Map Mypy error codes to severity.
 * Mypy errors are type errors which are generally high severity.
 */
export function mapMypySeverity(errorCode: string): Severity {
  // Type errors are high severity
  const highSeverityCodes = [
    "arg-type",
    "return-value",
    "assignment",
    "call-arg",
    "call-overload",
    "index",
    "attr-defined",
    "name-defined",
    "union-attr",
    "override",
    "operator",
    "misc",
  ];
  if (highSeverityCodes.some((c) => errorCode.includes(c))) {
    return "high";
  }
  // Import errors are medium
  if (errorCode.includes("import")) {
    return "medium";
  }
  // Note-level issues
  if (errorCode === "note") {
    return "low";
  }
  return "high"; // Default for type checker
}

/**
 * Map Mypy findings to confidence.
 * Type checker findings are typically high confidence.
 */
export function mapMypyConfidence(_errorCode: string): Confidence {
  // Mypy findings are definitive type errors
  return "high";
}

/**
 * Map Bandit severity levels to our scale.
 * Bandit uses LOW, MEDIUM, HIGH severity.
 */
export function mapBanditSeverity(banditSeverity: string): Severity {
  const normalized = banditSeverity.toUpperCase();
  if (normalized === "HIGH") {
    return "critical"; // Security high = critical
  }
  if (normalized === "MEDIUM") {
    return "high";
  }
  return "medium"; // LOW
}

/**
 * Map Bandit confidence levels to our scale.
 * Bandit uses LOW, MEDIUM, HIGH confidence.
 */
export function mapBanditConfidence(banditConfidence: string): Confidence {
  const normalized = banditConfidence.toUpperCase();
  if (normalized === "HIGH") {
    return "high";
  }
  if (normalized === "MEDIUM") {
    return "medium";
  }
  return "low";
}

// ============================================================================
// Java Tool Mappings
// ============================================================================

/**
 * Map PMD priority to severity.
 * PMD uses priority 1-5 (1 = highest, 5 = lowest).
 */
export function mapPmdSeverity(priority: number): Severity {
  if (priority === 1) {
    return "critical";
  }
  if (priority === 2) {
    return "high";
  }
  if (priority === 3) {
    return "medium";
  }
  return "low"; // 4 and 5
}

/**
 * Map PMD findings to confidence based on rule category.
 */
export function mapPmdConfidence(ruleSet: string): Confidence {
  const normalized = ruleSet.toLowerCase();
  // Error-prone rules are high confidence
  if (normalized.includes("errorprone")) {
    return "high";
  }
  // Security rules are medium (can have false positives)
  if (normalized.includes("security")) {
    return "medium";
  }
  // Best practices are medium
  if (normalized.includes("bestpractices")) {
    return "medium";
  }
  // Design/style rules are low
  if (normalized.includes("design") || normalized.includes("codestyle")) {
    return "low";
  }
  return "medium";
}

/**
 * Map SpotBugs rank to severity.
 * SpotBugs uses rank 1-20 (1 = scariest, 20 = least scary).
 * Also uses categories: CORRECTNESS, SECURITY, PERFORMANCE, etc.
 */
export function mapSpotBugsSeverity(rank: number, category?: string): Severity {
  // Security issues are always high+
  if (category?.toUpperCase() === "SECURITY") {
    if (rank <= 4) return "critical";
    return "high";
  }
  // Correctness bugs
  if (category?.toUpperCase() === "CORRECTNESS") {
    if (rank <= 4) return "critical";
    if (rank <= 9) return "high";
    return "medium";
  }
  // General rank-based mapping
  if (rank <= 4) {
    return "critical";
  }
  if (rank <= 9) {
    return "high";
  }
  if (rank <= 14) {
    return "medium";
  }
  return "low";
}

/**
 * Map SpotBugs confidence to our scale.
 * SpotBugs uses 1 (high), 2 (medium), 3 (low) for confidence.
 */
export function mapSpotBugsConfidence(confidence: number): Confidence {
  if (confidence === 1) {
    return "high";
  }
  if (confidence === 2) {
    return "medium";
  }
  return "low";
}

// ============================================================================
// Layer Classification
// ============================================================================

/**
 * Classify a finding into a layer based on tool and rule.
 */
export function classifyLayer(tool: ToolName, ruleId: string): Layer {
  // Security tools are always security layer
  if (tool === "bandit" || tool === "spotbugs") {
    // SpotBugs can have non-security findings
    const ruleIdLower = ruleId.toLowerCase();
    if (
      tool === "spotbugs" &&
      !ruleIdLower.includes("security") &&
      !ruleIdLower.includes("sql") &&
      !ruleIdLower.includes("xss")
    ) {
      return "code";
    }
    return "security";
  }

  // GitHub Security Advisories and CVEs are always security
  if (
    ruleId.startsWith("GHSA-") ||
    ruleId.startsWith("CVE-") ||
    ruleId.startsWith("CWE-")
  ) {
    return "security";
  }

  // osv-scanner findings (from Trunk) are security
  if (tool === "trunk" && (ruleId.includes("GHSA") || ruleId.includes("CVE"))) {
    return "security";
  }

  // Security layer patterns
  const securityPatterns = [
    "security",
    "xss",
    "injection",
    "csrf",
    "sql",
    "xxe",
    "ssrf",
    "auth",
    "crypto",
    "secret",
    "password",
    "eval",
    "dangerous",
    "hardcoded",
    "random",
    "prototype",
    "pollution",
    "vulnerable",
  ];

  const ruleIdLower = ruleId.toLowerCase();
  if (securityPatterns.some((p) => ruleIdLower.includes(p))) {
    return "security";
  }

  // Ruff security rules (S prefix)
  if (tool === "ruff" && ruleId.startsWith("S")) {
    return "security";
  }

  // Architecture layer
  if (tool === "dependency-cruiser" || tool === "knip") {
    return "architecture";
  }
  if (
    ruleIdLower.includes("import") ||
    ruleIdLower.includes("dependency") ||
    ruleIdLower.includes("cycle")
  ) {
    return "architecture";
  }

  // System layer (build, config issues)
  if (tool === "tsc" || tool === "mypy") {
    // Type errors are code-level
    return "code";
  }

  // Default: code layer
  return "code";
}

// ============================================================================
// Effort Estimation
// ============================================================================

/**
 * Estimate effort to fix a finding.
 *
 * S (Small): Quick fix, often autofix available, single location
 * M (Medium): Requires some thought, multiple changes, or investigation
 * L (Large): Significant refactoring, architectural changes
 */
export function estimateEffort(
  tool: ToolName,
  ruleId: string,
  locationCount: number,
  hasAutofix: boolean,
): Effort {
  // Autofix available = Small effort
  if (hasAutofix) {
    return "S";
  }

  // Multiple locations = at least Medium
  if (locationCount > 3) {
    return "L";
  }
  if (locationCount > 1) {
    return "M";
  }

  // Tool-specific heuristics
  if (tool === "jscpd") {
    // Duplicate code refactoring is typically Medium to Large
    return "M";
  }

  if (tool === "dependency-cruiser") {
    // Fixing dependency cycles is typically Large
    if (ruleId.toLowerCase().includes("cycle")) {
      return "L";
    }
    return "M";
  }

  if (tool === "knip") {
    // Removing unused code is typically Small
    return "S";
  }

  if (tool === "tsc") {
    // Type errors can vary; assume Medium without more info
    return "M";
  }

  // ESLint/Prettier - typically Small if single location
  if (tool === "eslint" || tool === "prettier") {
    return "S";
  }

  // Python tools
  if (tool === "ruff") {
    // Ruff has autofix for many rules; if we get here, no autofix
    // Style rules (N, D) are Small, others Medium
    if (ruleId.startsWith("N") || ruleId.startsWith("D")) {
      return "S";
    }
    return "M";
  }

  if (tool === "mypy") {
    // Type errors vary; assume Medium
    return "M";
  }

  if (tool === "bandit") {
    // Security issues vary widely
    // Hardcoded passwords/secrets are typically Small (remove/externalize)
    if (
      ruleId.includes("hardcoded") ||
      ruleId.includes("B105") ||
      ruleId.includes("B106")
    ) {
      return "S";
    }
    // Most security fixes require investigation
    return "M";
  }

  // Java tools
  if (tool === "pmd") {
    // PMD covers wide range; default to Medium
    const ruleIdLower = ruleId.toLowerCase();
    if (ruleIdLower.includes("unused") || ruleIdLower.includes("empty")) {
      return "S";
    }
    return "M";
  }

  if (tool === "spotbugs") {
    // SpotBugs findings typically require investigation
    return "M";
  }

  // Default: Medium
  return "M";
}

// ============================================================================
// Autofix Detection
// ============================================================================

/**
 * Determine autofix level based on tool and rule.
 */
export function determineAutofixLevel(
  tool: ToolName,
  ruleId: string,
  hasFixInfo: boolean,
): AutofixLevel {
  // Prettier always has safe autofix
  if (tool === "prettier") {
    return "safe";
  }

  // ESLint with fix info
  if (tool === "eslint" && hasFixInfo) {
    // Some ESLint fixes are safe, others need review
    const safeRules = [
      "semi",
      "quotes",
      "indent",
      "comma-dangle",
      "no-extra-semi",
      "no-trailing-spaces",
      "eol-last",
      "space-before-function-paren",
      "object-curly-spacing",
      "array-bracket-spacing",
      "prefer-const",
      "no-var",
    ];

    if (safeRules.some((r) => ruleId.includes(r))) {
      return "safe";
    }
    return "requires_review";
  }

  // Trunk may provide autofix
  if (tool === "trunk" && hasFixInfo) {
    return "requires_review";
  }

  // Ruff has autofix for many rules
  if (tool === "ruff" && hasFixInfo) {
    // Safe formatting/style fixes
    const safeRuffRules = [
      "I", // isort (import sorting)
      "W", // pycodestyle warnings (whitespace)
      "E1", // indentation
      "E2", // whitespace
      "E3", // blank lines
      "E7", // statement (e.g., multiple statements)
      "Q", // quotes
      "COM", // commas
      "UP", // pyupgrade (safe modernizations)
    ];
    if (safeRuffRules.some((prefix) => ruleId.startsWith(prefix))) {
      return "safe";
    }
    return "requires_review";
  }

  return "none";
}

// ============================================================================
// Threshold Checking
// ============================================================================

/**
 * Check if a finding meets severity and confidence thresholds.
 * Use 'info' for severity threshold to allow all severities.
 */
export function meetsThresholds(
  severity: Severity,
  confidence: Confidence,
  severityThreshold: Severity | "info",
  confidenceThreshold: Confidence,
): boolean {
  return (
    meetsSeverityThreshold(severity, severityThreshold) &&
    meetsConfidenceThreshold(confidence, confidenceThreshold)
  );
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Compare two findings for deterministic sorting.
 * Order: severity desc, confidence desc, path asc, line asc
 */
export function compareFindingsForSort(
  a: {
    severity: Severity;
    confidence: Confidence;
    locations: { path: string; startLine: number }[];
  },
  b: {
    severity: Severity;
    confidence: Confidence;
    locations: { path: string; startLine: number }[];
  },
): number {
  // Severity descending
  const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  if (severityDiff !== 0) return severityDiff;

  // Confidence descending
  const confidenceDiff =
    CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
  if (confidenceDiff !== 0) return confidenceDiff;

  // Path ascending
  const pathA = a.locations[0]?.path ?? "";
  const pathB = b.locations[0]?.path ?? "";
  const pathDiff = pathA.localeCompare(pathB);
  if (pathDiff !== 0) return pathDiff;

  // Line ascending
  const lineA = a.locations[0]?.startLine ?? 0;
  const lineB = b.locations[0]?.startLine ?? 0;
  return lineA - lineB;
}
