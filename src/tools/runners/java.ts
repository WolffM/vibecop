/**
 * Java Tool Runners
 *
 * Runners for Java analysis tools: PMD, SpotBugs
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "../../core/types.js";
import { isToolAvailable, safeParseJson } from "../tool-utils.js";
import {
  parsePmdOutput,
  parseSpotBugsOutput,
  type PmdOutput,
  type SpotBugsSarifOutput,
} from "../../parsers.js";

/** Max buffer size for tool output */
const MAX_OUTPUT_BUFFER = 50 * 1024 * 1024; // 50MB

/**
 * Run PMD static analyzer for Java code.
 */
export function runPmd(rootPath: string, configPath?: string): Finding[] {
  console.log("Running PMD...");

  try {
    const { available } = isToolAvailable("pmd", false);
    if (!available) {
      console.log("  PMD not installed, skipping");
      return [];
    }

    // Use quickstart ruleset if no config provided
    const rulesets = configPath || "rulesets/java/quickstart.xml";
    // PMD 7.x requires a file for --ignore-list, so we use glob patterns instead
    // to exclude common directories from scanning
    const args = [
      "check",
      "-d",
      ".",
      "-R",
      rulesets,
      "-f",
      "json",
      "--no-progress",
    ];

    const result = spawnSync("pmd", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // PMD outputs JSON to stdout
    const output = result.stdout || "";
    const parsed = safeParseJson<PmdOutput>(output);
    if (parsed) {
      return parsePmdOutput(parsed);
    }
  } catch (error) {
    console.warn("PMD failed:", error);
  }

  return [];
}

/**
 * Run SpotBugs bytecode analyzer for Java code.
 * Note: SpotBugs requires compiled .class files.
 */
export function runSpotBugs(rootPath: string, configPath?: string): Finding[] {
  console.log("Running SpotBugs...");

  try {
    // Check if compiled classes exist (standard locations + test-fixtures)
    const targetClasses = join(rootPath, "target", "classes");
    const buildClasses = join(rootPath, "build", "classes");
    const testFixturesClasses = join(
      rootPath,
      "test-fixtures",
      "target",
      "classes",
    );

    let classesDir: string | null = null;
    if (existsSync(targetClasses)) {
      classesDir = targetClasses;
    } else if (existsSync(buildClasses)) {
      classesDir = buildClasses;
    } else if (existsSync(testFixturesClasses)) {
      classesDir = testFixturesClasses;
    }

    if (!classesDir) {
      console.log(
        "  No compiled classes found (target/classes, build/classes, or test-fixtures/target/classes), skipping",
      );
      return [];
    }

    const { available } = isToolAvailable("spotbugs", false);
    if (!available) {
      console.log("  SpotBugs not installed, skipping");
      return [];
    }

    const args = ["-sarif", classesDir];
    if (configPath) {
      args.unshift("-exclude", configPath);
    }

    const result = spawnSync("spotbugs", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // SpotBugs outputs SARIF to stdout when using -sarif
    const output = result.stdout || "";
    if (output.includes('"$schema"') && output.includes('"runs"')) {
      const parsed = safeParseJson<SpotBugsSarifOutput>(output);
      if (parsed) {
        return parseSpotBugsOutput(parsed);
      }
    }
  } catch (error) {
    console.warn("SpotBugs failed:", error);
  }

  return [];
}
