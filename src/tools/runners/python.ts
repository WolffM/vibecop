/**
 * Python Tool Runners
 *
 * Runners for Python analysis tools: Ruff, Mypy, Bandit
 */

import { spawnSync } from "node:child_process";
import type { Finding } from "../../core/types.js";
import {
  EXCLUDE_DIRS_PYTHON,
  isToolAvailable,
  safeParseJson,
} from "../tool-utils.js";
import {
  parseRuffOutput,
  parseMypyOutput,
  parseBanditOutput,
  type BanditOutput,
} from "../../parsers.js";

/** Max buffer size for tool output */
const MAX_OUTPUT_BUFFER = 50 * 1024 * 1024; // 50MB

/**
 * Run Ruff linter for Python code.
 */
export function runRuff(rootPath: string, configPath?: string): Finding[] {
  console.log("Running ruff...");

  try {
    const { available } = isToolAvailable("ruff", false);
    if (!available) {
      console.log("  Ruff not installed, skipping");
      return [];
    }

    const args = [
      "check",
      "--output-format",
      "json",
      "--exclude",
      EXCLUDE_DIRS_PYTHON,
    ];
    if (configPath) {
      args.push("--config", configPath);
    }
    args.push(".");

    const result = spawnSync("ruff", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // Ruff outputs JSON array to stdout
    const output = result.stdout || "";
    if (output.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(output);
        return parseRuffOutput(parsed);
      } catch {
        console.warn("Failed to parse ruff JSON output");
      }
    }
  } catch (error) {
    console.warn("ruff failed:", error);
  }

  return [];
}

/**
 * Run Mypy type checker for Python code.
 */
export function runMypy(rootPath: string, configPath?: string): Finding[] {
  console.log("Running mypy...");

  try {
    const { available } = isToolAvailable("mypy", false);
    if (!available) {
      console.log("  Mypy not installed, skipping");
      return [];
    }

    // Use --output=json for native JSON output (Python 3.10+)
    const args = ["--output", "json", "--exclude", EXCLUDE_DIRS_PYTHON];
    if (configPath) {
      args.push("--config-file", configPath);
    }
    args.push(".");

    const result = spawnSync("mypy", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // Mypy JSON output is one JSON object per line
    const output = result.stdout || "";
    const errors: Array<{
      file: string;
      line: number;
      column: number;
      message: string;
      hint: string | null;
      code: string | null;
      severity: string;
    }> = [];

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{")) {
        try {
          errors.push(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
    }

    if (errors.length > 0) {
      return parseMypyOutput(errors);
    }
  } catch (error) {
    console.warn("mypy failed:", error);
  }

  return [];
}

/**
 * Run Bandit security scanner for Python code.
 */
export function runBandit(rootPath: string, configPath?: string): Finding[] {
  console.log("Running bandit...");

  try {
    const { available } = isToolAvailable("bandit", false);
    if (!available) {
      console.log("  Bandit not installed, skipping");
      return [];
    }

    const args = ["-f", "json", "-r", ".", "--exclude", EXCLUDE_DIRS_PYTHON];
    if (configPath) {
      args.push("-c", configPath);
    }

    const result = spawnSync("bandit", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // Bandit outputs JSON to stdout
    const output = result.stdout || "";
    const parsed = safeParseJson<BanditOutput>(output);
    if (parsed) {
      return parseBanditOutput(parsed);
    }
  } catch (error) {
    console.warn("bandit failed:", error);
  }

  return [];
}
