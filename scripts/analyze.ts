/**
 * Main Analysis Orchestrator
 *
 * Coordinates the full analysis pipeline: tool execution, parsing,
 * SARIF/LLM JSON generation, and issue creation.
 *
 * Reference: vibeCop_spec.md section 9
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { detectRepo } from './repo-detect.js';
import {
  parseEslintOutput,
  parseTscTextOutput,
  parseTscOutput,
  parseJscpdOutput,
  parseTrunkOutput,
} from './parsers.js';
import { buildSarifLog, writeSarifFile } from './build-sarif.js';
import { buildLlmJson, writeLlmJsonFile } from './build-llm-json.js';
import { processFindings } from './sarif-to-issues.js';
import { deduplicateFindings } from './fingerprints.js';
import type {
  Cadence,
  Finding,
  RepoProfile,
  RunContext,
  VibeCopConfig,
} from './types.js';

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load vibecop.yml config from repo root.
 */
function loadVibeCopConfig(rootPath: string, configPath: string = 'vibecop.yml'): VibeCopConfig {
  const fullPath = join(rootPath, configPath);

  if (!existsSync(fullPath)) {
    console.log(`No config file found at ${fullPath}, using defaults`);
    return { version: 1 };
  }

  try {
    // Simple YAML parsing for our subset
    const content = readFileSync(fullPath, 'utf-8');
    // For MVP, use JSON config or basic YAML parsing
    // In production, use a proper YAML parser
    if (fullPath.endsWith('.json')) {
      return JSON.parse(content);
    }

    // Basic YAML-like parsing (good enough for MVP)
    // In production, install yaml package
    console.log(`Config file found at ${fullPath}`);
    return parseSimpleYaml(content);
  } catch (error) {
    console.warn(`Failed to parse config file: ${error}`);
    return { version: 1 };
  }
}

/**
 * Very basic YAML parser for vibecop.yml structure.
 * For production, use the 'yaml' npm package.
 */
function parseSimpleYaml(content: string): VibeCopConfig {
  // This is a simplified parser - for production use a real YAML library
  const config: VibeCopConfig = { version: 1 };

  try {
    // Remove comments and parse as basic key-value
    // For MVP, just return defaults - config parsing would need yaml package
    const _lines = content.split('\n').filter((l) => !l.trim().startsWith('#'));
    console.log('Note: Full YAML parsing requires yaml package. Using defaults.');
    void _lines; // TODO: implement proper YAML parsing
  } catch {
    // Fallback to defaults
  }

  return config;
}

/**
 * Determine if a tool should run based on config and cadence.
 */
function shouldRunTool(
  enabled: boolean | 'auto' | Cadence | undefined,
  _profile: RepoProfile,
  currentCadence: Cadence,
  toolDetector: () => boolean
): boolean {
  if (enabled === false) return false;
  if (enabled === true) return true;

  // Cadence-based enablement
  if (enabled === 'daily' || enabled === 'weekly' || enabled === 'monthly') {
    const cadenceOrder = { daily: 0, weekly: 1, monthly: 2 };
    return cadenceOrder[currentCadence] >= cadenceOrder[enabled];
  }

  // Auto-detect
  if (enabled === 'auto' || enabled === undefined) {
    return toolDetector();
  }

  return false;
}

// ============================================================================
// Tool Runners
// ============================================================================

/**
 * Run Trunk check and capture output.
 */
function runTrunk(rootPath: string, args: string[] = ['check']): Finding[] {
  console.log('Running Trunk...');

  try {
    const trunkResult = spawnSync('trunk', [...args, '--output=json'], {
      cwd: rootPath,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    if (trunkResult.stdout) {
      try {
        const output = JSON.parse(trunkResult.stdout);
        return parseTrunkOutput(output);
      } catch {
        console.warn('Failed to parse Trunk JSON output');
      }
    }

    if (trunkResult.stderr) {
      console.log('Trunk stderr:', trunkResult.stderr);
    }
  } catch (error) {
    console.warn('Trunk not available or failed:', error);
  }

  return [];
}

/**
 * Run TypeScript type checking.
 */
function runTsc(rootPath: string): Finding[] {
  console.log('Running TypeScript check...');

  try {
    const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
      cwd: rootPath,
      encoding: 'utf-8',
      shell: true,
    });

    // tsc exits with error code when there are type errors
    const output = result.stdout + result.stderr;
    const diagnostics = parseTscTextOutput(output);
    return parseTscOutput(diagnostics);
  } catch (error) {
    console.warn('TypeScript check failed:', error);
  }

  return [];
}

/**
 * Run ESLint.
 */
function runEslint(rootPath: string): Finding[] {
  console.log('Running ESLint...');

  try {
    const result = spawnSync('npx', ['eslint', '.', '--format=json', '--max-warnings=999999'], {
      cwd: rootPath,
      encoding: 'utf-8',
      shell: true,
      maxBuffer: 50 * 1024 * 1024,
    });

    const output = result.stdout;
    if (output) {
      try {
        const eslintResults = JSON.parse(output);
        return parseEslintOutput(eslintResults);
      } catch {
        console.warn('Failed to parse ESLint JSON output');
      }
    }
  } catch (error) {
    console.warn('ESLint failed:', error);
  }

  return [];
}

/**
 * Run jscpd (copy-paste detector).
 */
function runJscpd(rootPath: string, minTokens: number = 70): Finding[] {
  console.log('Running jscpd...');

  try {
    const outputPath = join(rootPath, '.vibecop-output', 'jscpd.json');

    // Run jscpd - we don't need the result, just the output file
    spawnSync(
      'npx',
      [
        'jscpd',
        '.',
        `--min-tokens=${minTokens}`,
        '--reporters=json',
        `--output=${join(rootPath, '.vibecop-output')}`,
        '--ignore="**/node_modules/**,**/dist/**,**/build/**,**/.git/**"',
      ],
      {
        cwd: rootPath,
        encoding: 'utf-8',
        shell: true,
      }
    );

    if (existsSync(outputPath)) {
      const output = JSON.parse(readFileSync(outputPath, 'utf-8'));
      return parseJscpdOutput(output);
    }
  } catch (error) {
    console.warn('jscpd failed:', error);
  }

  return [];
}

// ============================================================================
// Main Analysis Pipeline
// ============================================================================

export interface AnalyzeOptions {
  rootPath?: string;
  configPath?: string;
  cadence?: Cadence;
  outputDir?: string;
  skipIssues?: boolean;
}

export interface AnalyzeResult {
  findings: Finding[];
  profile: RepoProfile;
  context: RunContext;
  stats: {
    totalFindings: number;
    uniqueFindings: number;
    byTool: Record<string, number>;
  };
}

/**
 * Run the full analysis pipeline.
 */
export async function analyze(options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const rootPath = options.rootPath || process.cwd();
  const configPath = options.configPath || 'vibecop.yml';
  const cadence = options.cadence || 'weekly';
  const outputDir = options.outputDir || join(rootPath, '.vibecop-output');

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log('=== vibeCop Analysis ===');
  console.log(`Root: ${rootPath}`);
  console.log(`Cadence: ${cadence}`);
  console.log('');

  // Step 1: Detect repo profile
  console.log('Step 1: Detecting repository profile...');
  const profile = await detectRepo(rootPath);
  console.log(`  Languages: ${profile.languages.join(', ')}`);
  console.log(`  Package manager: ${profile.packageManager}`);
  console.log(`  Monorepo: ${profile.isMonorepo}`);
  console.log('');

  // Step 2: Load configuration
  console.log('Step 2: Loading configuration...');
  const config = loadVibeCopConfig(rootPath, configPath);
  console.log('');

  // Step 3: Run analysis tools
  console.log('Step 3: Running analysis tools...');
  const allFindings: Finding[] = [];

  // Trunk (if available)
  if (config.trunk?.enabled !== false) {
    const trunkFindings = runTrunk(rootPath, (config.trunk?.arguments || 'check').split(' '));
    allFindings.push(...trunkFindings);
    console.log(`  Trunk: ${trunkFindings.length} findings`);
  }

  // TypeScript
  if (shouldRunTool(config.tools?.tsc?.enabled, profile, cadence, () => profile.hasTypeScript)) {
    const tscFindings = runTsc(rootPath);
    allFindings.push(...tscFindings);
    console.log(`  TypeScript: ${tscFindings.length} findings`);
  }

  // ESLint
  if (shouldRunTool(config.tools?.eslint?.enabled, profile, cadence, () => profile.hasEslint)) {
    const eslintFindings = runEslint(rootPath);
    allFindings.push(...eslintFindings);
    console.log(`  ESLint: ${eslintFindings.length} findings`);
  }

  // jscpd (weekly/monthly)
  if (shouldRunTool(config.tools?.jscpd?.enabled || 'weekly', profile, cadence, () => true)) {
    const jscpdFindings = runJscpd(rootPath, config.tools?.jscpd?.min_tokens);
    allFindings.push(...jscpdFindings);
    console.log(`  jscpd: ${jscpdFindings.length} findings`);
  }

  console.log('');

  // Step 4: Deduplicate findings
  console.log('Step 4: Deduplicating findings...');
  const uniqueFindings = deduplicateFindings(allFindings);
  console.log(`  Total: ${allFindings.length} -> Unique: ${uniqueFindings.length}`);
  console.log('');

  // Build context
  const context: RunContext = {
    repo: {
      owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
      name: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown',
      defaultBranch: 'main',
      commit: process.env.GITHUB_SHA || 'unknown',
    },
    profile,
    config,
    cadence,
    runNumber: parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10),
    workspacePath: rootPath,
    outputDir,
  };

  // Step 5: Generate outputs
  console.log('Step 5: Generating outputs...');

  // Write findings for other scripts
  const findingsPath = join(outputDir, 'findings.json');
  writeFileSync(findingsPath, JSON.stringify(uniqueFindings, null, 2));
  console.log(`  Findings: ${findingsPath}`);

  // Write context
  const contextPath = join(outputDir, 'context.json');
  writeFileSync(contextPath, JSON.stringify(context, null, 2));
  console.log(`  Context: ${contextPath}`);

  // Build SARIF
  if (config.output?.sarif !== false) {
    const sarif = buildSarifLog(uniqueFindings, context);
    const sarifPath = join(outputDir, 'results.sarif');
    writeSarifFile(sarif, sarifPath);
    console.log(`  SARIF: ${sarifPath}`);
  }

  // Build LLM JSON
  if (config.output?.llm_json !== false) {
    const llmJson = buildLlmJson(uniqueFindings, context);
    const llmJsonPath = join(outputDir, 'results.llm.json');
    writeLlmJsonFile(llmJson, llmJsonPath);
    console.log(`  LLM JSON: ${llmJsonPath}`);
  }

  console.log('');

  // Step 6: Create/update issues
  if (!options.skipIssues && config.issues?.enabled !== false && process.env.GITHUB_TOKEN) {
    console.log('Step 6: Processing GitHub issues...');
    const issueStats = await processFindings(uniqueFindings, context);
    console.log(`  Created: ${issueStats.created}`);
    console.log(`  Updated: ${issueStats.updated}`);
    console.log(`  Closed: ${issueStats.closed}`);
  } else {
    console.log('Step 6: Skipping GitHub issues (disabled or no token)');
  }

  console.log('');
  console.log('=== Analysis Complete ===');

  // Calculate stats
  const byTool: Record<string, number> = {};
  for (const finding of uniqueFindings) {
    byTool[finding.tool] = (byTool[finding.tool] || 0) + 1;
  }

  return {
    findings: uniqueFindings,
    profile,
    context,
    stats: {
      totalFindings: allFindings.length,
      uniqueFindings: uniqueFindings.length,
      byTool,
    },
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const options: AnalyzeOptions = {
    rootPath: process.cwd(),
    cadence: 'weekly',
  };

  // Parse simple CLI args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root' && args[i + 1]) {
      options.rootPath = args[++i];
    } else if (arg === '--cadence' && args[i + 1]) {
      options.cadence = args[++i] as Cadence;
    } else if (arg === '--config' && args[i + 1]) {
      options.configPath = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (arg === '--skip-issues') {
      options.skipIssues = true;
    }
  }

  try {
    const result = await analyze(options);

    // Exit with error code if there are high-severity findings
    const highSeverity = result.findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical'
    );
    if (highSeverity.length > 0) {
      console.log(`\n⚠️  Found ${highSeverity.length} high/critical severity findings`);
      // Don't exit with error for scheduled runs - just report
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
