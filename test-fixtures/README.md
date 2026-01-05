# Test Fixtures

This directory contains intentionally "dirty" code to demonstrate all vibeCop analysis tools.
These files trigger at least one issue per tool, which remain open as demo issues in this repo.

## Files and What They Test

| File                                          | Tool(s)                | Issues                                                |
| --------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `typescript-errors.ts`                        | **tsc**                | Type mismatches, missing properties, implicit any     |
| `markdown-issues.md`                          | **Trunk/markdownlint** | Heading format, line length, blank lines              |
| `yaml-issues.yaml`                            | **Trunk/yamllint**     | Indentation, duplicate keys, truthy values            |
| `duplicate-code-a.ts` + `duplicate-code-b.ts` | **jscpd**              | ~60 lines of duplicated validation code               |
| `circular-dep-a.ts` + `circular-dep-b.ts`     | **dependency-cruiser** | Circular import dependency                            |
| `unused-exports.ts`                           | **knip**               | Exported but never imported functions, classes, types |
| `security-issues.ts`                          | **Semgrep**            | `eval()`, command injection patterns                  |

## Tool Coverage Summary

| Tool                   | Findings    | Description                         |
| ---------------------- | ----------- | ----------------------------------- |
| **Trunk**              | ✅ Multiple | markdownlint, yamllint, osv-scanner |
| **tsc**                | ✅ Multiple | TypeScript compiler errors          |
| **jscpd**              | ✅ 1+       | Duplicate code blocks               |
| **dependency-cruiser** | ✅ 1        | Circular dependency                 |
| **knip**               | ✅ Multiple | Unused exports and dependencies     |
| **Semgrep**            | ✅ 1+       | Security vulnerabilities            |

## Running Analysis

```bash
# Quick verbose analysis (shows all findings)
npx tsx scripts/verbose-analyze.ts --root="."

# With severity filter
npx tsx scripts/verbose-analyze.ts --severity-threshold=high

# With different merge strategy
npx tsx scripts/verbose-analyze.ts --merge-strategy=same-file
```

## Demo Issues

When vibeCop runs on this repo, it creates GitHub issues for each finding.
These issues serve as:

1. **Demos** - Show what vibeCop-created issues look like
2. **Test targets** - AI agents can practice fixing them
3. **Documentation** - Each issue explains the problem and fix

Issues are labeled with `vibeCop` and include:

- Severity and confidence ratings
- All affected file locations (merged)
- Agent instructions with branch naming
- Fingerprint for deduplication
