#!/usr/bin/env node
/**
 * PinGlass Anti-Pattern Checker
 *
 * Scans staged files for known anti-patterns before commit.
 * Exit code 1 = anti-patterns found, commit blocked.
 *
 * Usage: node scripts/check-antipatterns.mjs [--all]
 *   --all: Check all files, not just staged
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

const ROOT = process.cwd();

// ============================================================================
// ANTI-PATTERNS CONFIGURATION
// ============================================================================

const ANTIPATTERNS = [
  {
    id: 'USER_STATUS_TIERS',
    severity: 'CRITICAL',
    description: 'User status tiers (is_pro, isPro) do not exist in this project',
    patterns: [
      /is_pro\s*[=!]/gi,
      /isPro\s*[=!&|?:]/gi,
      /user\.isPro/gi,
      /user\.is_pro/gi,
      /status\s*===?\s*['"`]free['"`]/gi,
      /status\s*===?\s*['"`]pro['"`]/gi,
      /WHERE\s+.*is_pro/gi,
    ],
    exclude: [
      'check-antipatterns.mjs',
      'project-context.md',
      'CLAUDE.md',
      '.md',
    ],
    fix: 'Use payment status check: SELECT COUNT(*) FROM payments WHERE user_id=? AND status=\'succeeded\'',
  },
  {
    id: 'SYNC_GENERATION',
    severity: 'WARNING',
    description: 'Synchronous generation will timeout (Cloudflare 100s limit)',
    patterns: [
      /await\s+generateAllPhotos/gi,
      /await\s+generateAndWait/gi,
      /await\s+generateImages\s*\([^)]*\)\s*;?\s*\/\/.*wait/gi,
    ],
    exclude: [],
    fix: 'Use createKieTask() for fire-and-forget, poll with /api/cron/poll-kie-tasks',
  },
  {
    id: 'HARDCODED_PRICE',
    severity: 'WARNING',
    description: 'Hardcoded prices should come from admin_settings',
    patterns: [
      /(?:const|let|var)\s+(?:PRICE|price)\s*=\s*\d{3,}/gi,
      /amount\s*[:=]\s*(?:499|999|1499|1999)\b/gi,
    ],
    exclude: [
      'test',
      'spec',
      'mock',
      '.md',
    ],
    fix: 'Read from: sql`SELECT value FROM admin_settings WHERE key = \'pricing_tiers\'`',
  },
  {
    id: 'WRONG_TABLE_NAME',
    severity: 'CRITICAL',
    description: 'Table telegram_queue does not exist',
    patterns: [
      /telegram_queue(?!\s*_)/gi,  // telegram_queue but not telegram_queue_*
      /FROM\s+telegram_queue\b/gi,
      /INTO\s+telegram_queue\b/gi,
    ],
    exclude: [],
    fix: 'Use telegram_message_queue instead',
  },
  {
    id: 'CHECK_THEN_UPDATE',
    severity: 'WARNING',
    description: 'Check-then-update pattern causes race conditions',
    patterns: [
      // Detect SELECT followed by UPDATE on same table within 10 lines
      /SELECT.*balance.*FROM\s+referral_balances[\s\S]{0,500}UPDATE\s+referral_balances\s+SET\s+balance/gi,
    ],
    exclude: [],
    fix: 'Use atomic UPDATE: UPDATE table SET x = x - $1 WHERE x >= $1 RETURNING x',
  },
  {
    id: 'MISSING_RETURNING',
    severity: 'INFO',
    description: 'UPDATE without RETURNING may miss race condition detection',
    patterns: [
      /UPDATE\s+payments\s+SET[^;]+(?<!RETURNING\s+\w+)\s*`/gi,
    ],
    exclude: [],
    fix: 'Add RETURNING clause: UPDATE ... RETURNING id',
  },
];

// ============================================================================
// FILE COLLECTION
// ============================================================================

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      cwd: ROOT,
    });
    return output.split('\n').filter(f => f.trim());
  } catch {
    return [];
  }
}

function getAllFiles() {
  try {
    const output = execSync('git ls-files', {
      encoding: 'utf-8',
      cwd: ROOT,
    });
    return output.split('\n').filter(f => f.trim());
  } catch {
    return [];
  }
}

// ============================================================================
// PATTERN CHECKING
// ============================================================================

function shouldExclude(filePath, excludePatterns) {
  const lower = filePath.toLowerCase();
  return excludePatterns.some(pattern => lower.includes(pattern.toLowerCase()));
}

function checkFile(filePath, antipattern) {
  if (shouldExclude(filePath, antipattern.exclude)) {
    return [];
  }

  const absolutePath = resolve(ROOT, filePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  // Only check JS/TS files
  if (!/\.(js|jsx|ts|tsx|mjs)$/.test(filePath)) {
    return [];
  }

  let content;
  try {
    content = readFileSync(absolutePath, 'utf-8');
  } catch {
    return [];
  }

  const violations = [];
  const lines = content.split('\n');

  for (const pattern of antipattern.patterns) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.slice(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1]?.trim() || '';

      violations.push({
        file: filePath,
        line: lineNumber,
        match: match[0],
        context: line.slice(0, 80),
        antipattern,
      });
    }
  }

  return violations;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const checkAll = process.argv.includes('--all');
  const files = checkAll ? getAllFiles() : getStagedFiles();

  if (files.length === 0) {
    console.log('No files to check.');
    process.exit(0);
  }

  console.log(`\n🔍 Checking ${files.length} file(s) for anti-patterns...\n`);

  const allViolations = [];

  for (const antipattern of ANTIPATTERNS) {
    for (const file of files) {
      const violations = checkFile(file, antipattern);
      allViolations.push(...violations);
    }
  }

  if (allViolations.length === 0) {
    console.log('✅ No anti-patterns detected!\n');
    process.exit(0);
  }

  // Group by severity
  const critical = allViolations.filter(v => v.antipattern.severity === 'CRITICAL');
  const warnings = allViolations.filter(v => v.antipattern.severity === 'WARNING');
  const info = allViolations.filter(v => v.antipattern.severity === 'INFO');

  console.log('❌ Anti-patterns detected:\n');

  for (const violation of allViolations) {
    const icon = violation.antipattern.severity === 'CRITICAL' ? '🚨' :
                 violation.antipattern.severity === 'WARNING' ? '⚠️' : 'ℹ️';

    console.log(`${icon} [${violation.antipattern.id}] ${violation.file}:${violation.line}`);
    console.log(`   Match: ${violation.match}`);
    console.log(`   Context: ${violation.context}`);
    console.log(`   Fix: ${violation.antipattern.fix}`);
    console.log('');
  }

  console.log(`\nSummary: ${critical.length} critical, ${warnings.length} warnings, ${info.length} info\n`);

  // Block commit only on critical issues
  if (critical.length > 0) {
    console.log('🛑 Commit blocked due to CRITICAL anti-patterns.\n');
    console.log('Fix the issues above or use --no-verify to bypass (not recommended).\n');
    process.exit(1);
  }

  console.log('⚠️ Warnings found but commit allowed. Consider fixing these issues.\n');
  process.exit(0);
}

main();
