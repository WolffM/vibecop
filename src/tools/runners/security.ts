/**
 * Security Tool Runners
 *
 * Runners for security scanning tools: Semgrep
 */

import { spawnSync } from "node:child_process";
import type { Finding } from "../../core/types.js";
import { EXCLUDE_DIRS_COMMON, isToolAvailable } from "../tool-utils.js";
import { parseSemgrepOutput } from "../../parsers.js";

/** Max buffer size for tool output */
const MAX_OUTPUT_BUFFER = 50 * 1024 * 1024; // 50MB

/**
 * Run Semgrep for security vulnerability detection.
 */
export function runSemgrep(rootPath: string, configPath?: string): Finding[] {
  console.log("Running semgrep...");

  try {
    const { available } = isToolAvailable("semgrep", false); // semgrep is Python-based, no npx
    if (!available) {
      console.log("  Semgrep not installed, skipping");
      return [];
    }

    // Use security-audit ruleset by default (works better than 'auto' on Windows)
    const config = configPath || "p/security-audit";
    const args = [
      "scan",
      "--json",
      "--config",
      config,
      "--exclude",
      EXCLUDE_DIRS_COMMON,
      ".",
    ];

    const result = spawnSync("semgrep", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    });

    // Semgrep outputs JSON mixed with progress info, extract JSON portion
    const output = result.stdout || "";
    const jsonMatch = output.match(/\{[\s\S]*"version"[\s\S]*\}(?=\s*$)/);
    if (jsonMatch) {
      try {
        const semgrepOutput = JSON.parse(jsonMatch[0]);
        return parseSemgrepOutput(semgrepOutput);
      } catch (e) {
        console.warn("Failed to parse semgrep JSON output:", e);
      }
    }

    // Handle known Windows encoding issues gracefully
    if (result.stderr && result.stderr.includes("charmap")) {
      console.log(
        "  Semgrep has encoding issues, try: semgrep scan --config p/security-audit .",
      );
      return [];
    }
  } catch (error) {
    console.warn("semgrep failed:", error);
  }

  return [];
}
