#!/usr/bin/env node

/**
 * Codebase Snapshot Utility
 *
 * Creates and compares snapshots of the codebase to track changes.
 * Useful for identifying what documentation needs updates.
 *
 * Usage:
 *   npx ts-node scripts/codebase-snapshot.ts create      # Create new snapshot
 *   npx ts-node scripts/codebase-snapshot.ts compare     # Compare with last snapshot
 *   npx ts-node scripts/codebase-snapshot.ts report      # Generate report of changes
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

// Configuration
const ROOT_DIR = process.cwd();
const SNAPSHOTS_DIR = join(ROOT_DIR, '.snapshots');
const LATEST_SNAPSHOT = join(SNAPSHOTS_DIR, 'latest.json');
const PREVIOUS_SNAPSHOT = join(SNAPSHOTS_DIR, 'previous.json');
const SNAPSHOT_HISTORY = join(SNAPSHOTS_DIR, 'history.jsonl');
const DOCS_NEEDED = join(ROOT_DIR, 'DOCS_NEEDS_UPDATE.md');

// Files/folders to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  'venv',
  '.snapshots',
  'less'
];

interface FileInfo {
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number;
  lines?: number;
  extension?: string;
  lastModified: number;
}

interface Snapshot {
  timestamp: string;
  date: string;
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  byExtension: Record<string, { count: number; lines: number; size: number }>;
  files: Record<string, FileInfo>;
}

interface Change {
  type: 'added' | 'modified' | 'deleted' | 'unchanged';
  path: string;
  details?: {
    newLines?: number;
    oldLines?: number;
    newSize?: number;
    oldSize?: number;
    linesAdded?: number;
    linesRemoved?: number;
  };
}

// Helper functions
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function walkDirectory(dir: string, relativePath = ''): FileInfo[] {
  const files: FileInfo[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name;

      if (shouldIgnore(fullPath)) continue;

      const stat = statSync(fullPath);

      if (entry.isDirectory()) {
        files.push({
          path: fullPath,
          relativePath: relPath,
          type: 'directory',
          size: 0,
          lastModified: stat.mtimeMs,
        });

        // Recurse into subdirectories
        files.push(...walkDirectory(fullPath, relPath));
      } else {
        const ext = extname(entry.name).slice(1) || 'no-ext';
        const lines = ext && ['tsx', 'ts', 'jsx', 'js', 'py', 'lua', 'json', 'md'].includes(ext)
          ? countLines(fullPath)
          : 0;

        files.push({
          path: fullPath,
          relativePath: relPath,
          type: 'file',
          size: stat.size,
          lines,
          extension: ext,
          lastModified: stat.mtimeMs,
        });
      }
    }
  } catch (error) {
    console.error(`Error walking directory ${dir}:`, error);
  }

  return files;
}

function createSnapshot(): Snapshot {
  console.log('📸 Creating codebase snapshot...');

  const files = walkDirectory(ROOT_DIR);
  const fileRecords: Record<string, FileInfo> = {};
  const byExtension: Record<string, { count: number; lines: number; size: number }> = {};

  let totalLines = 0;
  let totalSize = 0;

  for (const file of files) {
    if (file.type === 'file') {
      fileRecords[file.relativePath] = file;
      totalSize += file.size;
      totalLines += file.lines || 0;

      const ext = file.extension || 'other';
      if (!byExtension[ext]) {
        byExtension[ext] = { count: 0, lines: 0, size: 0 };
      }
      byExtension[ext].count++;
      byExtension[ext].lines += file.lines || 0;
      byExtension[ext].size += file.size;
    }
  }

  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleString(),
    totalFiles: Object.keys(fileRecords).length,
    totalLines,
    totalSize,
    byExtension,
    files: fileRecords,
  };

  return snapshot;
}

function saveSnapshot(snapshot: Snapshot): void {
  // Ensure directory exists
  if (!existsSync(SNAPSHOTS_DIR)) {
    const fs = require('fs');
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  // Move current latest to previous
  if (existsSync(LATEST_SNAPSHOT)) {
    const fs = require('fs');
    if (existsSync(PREVIOUS_SNAPSHOT)) {
      fs.unlinkSync(PREVIOUS_SNAPSHOT);
    }
    fs.copyFileSync(LATEST_SNAPSHOT, PREVIOUS_SNAPSHOT);
  }

  // Save new snapshot as latest
  writeFileSync(LATEST_SNAPSHOT, JSON.stringify(snapshot, null, 2));

  // Append to history
  writeFileSync(SNAPSHOT_HISTORY, JSON.stringify(snapshot) + '\n', { flag: 'a' });

  console.log(`✓ Snapshot saved: ${snapshot.totalFiles} files, ${snapshot.totalLines} lines`);
}

function compareSnapshots(): Change[] {
  if (!existsSync(LATEST_SNAPSHOT) || !existsSync(PREVIOUS_SNAPSHOT)) {
    console.error('❌ Cannot compare: need both latest and previous snapshots');
    console.error('   Run: npx ts-node scripts/codebase-snapshot.ts create');
    process.exit(1);
  }

  const latest: Snapshot = JSON.parse(readFileSync(LATEST_SNAPSHOT, 'utf-8'));
  const previous: Snapshot = JSON.parse(readFileSync(PREVIOUS_SNAPSHOT, 'utf-8'));

  const changes: Change[] = [];
  const processedPaths = new Set<string>();

  // Check for added and modified files
  for (const [path, latestFile] of Object.entries(latest.files)) {
    processedPaths.add(path);

    const prevFile = previous.files[path];

    if (!prevFile) {
      // File was added
      changes.push({
        type: 'added',
        path,
        details: {
          newLines: latestFile.lines,
          newSize: latestFile.size,
        },
      });
    } else if (latestFile.lastModified !== prevFile.lastModified) {
      // File was modified
      const linesAdded = (latestFile.lines || 0) - (prevFile.lines || 0);
      changes.push({
        type: 'modified',
        path,
        details: {
          oldLines: prevFile.lines,
          newLines: latestFile.lines,
          oldSize: prevFile.size,
          newSize: latestFile.size,
          linesAdded: linesAdded > 0 ? linesAdded : 0,
          linesRemoved: linesAdded < 0 ? Math.abs(linesAdded) : 0,
        },
      });
    } else {
      changes.push({
        type: 'unchanged',
        path,
      });
    }
  }

  // Check for deleted files
  for (const [path, _] of Object.entries(previous.files)) {
    if (!processedPaths.has(path)) {
      changes.push({
        type: 'deleted',
        path,
      });
    }
  }

  return changes;
}

function generateReport(changes: Change[]): string {
  const added = changes.filter(c => c.type === 'added');
  const modified = changes.filter(c => c.type === 'modified');
  const deleted = changes.filter(c => c.type === 'deleted');

  let report = `# Documentation Update Needs\n\n`;
  report += `Generated: ${new Date().toLocaleString()}\n\n`;

  report += `## Summary\n\n`;
  report += `- **Added Files:** ${added.length}\n`;
  report += `- **Modified Files:** ${modified.length}\n`;
  report += `- **Deleted Files:** ${deleted.length}\n\n`;

  if (added.length > 0) {
    report += `## 🆕 New Files (Need Documentation)\n\n`;
    report += `New code files that need documentation:\n\n`;

    const codeFiles = added.filter(c => {
      const ext = c.path.split('.').pop();
      return ['tsx', 'ts', 'jsx', 'js', 'lua', 'py'].includes(ext || '');
    });

    for (const change of codeFiles.sort((a, b) => a.path.localeCompare(b.path))) {
      const lines = change.details?.newLines ? ` (${change.details.newLines} lines)` : '';
      report += `- [ ] \`${change.path}\`${lines}\n`;
    }
    report += '\n';
  }

  if (modified.length > 0) {
    report += `## 📝 Modified Files (Check Documentation)\n\n`;
    report += `Files that have been changed and may need documentation updates:\n\n`;

    const significantChanges = modified.filter(c => {
      const linesAdded = c.details?.linesAdded || 0;
      const linesRemoved = c.details?.linesRemoved || 0;
      return Math.abs(linesAdded) + Math.abs(linesRemoved) > 10;
    });

    for (const change of significantChanges.sort((a, b) => {
      const aLines = Math.abs((a.details?.linesAdded || 0) + (a.details?.linesRemoved || 0));
      const bLines = Math.abs((b.details?.linesAdded || 0) + (b.details?.linesRemoved || 0));
      return bLines - aLines;
    })) {
      const added = change.details?.linesAdded || 0;
      const removed = change.details?.linesRemoved || 0;
      const total = added + removed;
      report += `- [ ] \`${change.path}\` (+${added} -${removed} = ${total} lines changed)\n`;
    }
    report += '\n';
  }

  if (deleted.length > 0) {
    report += `## ❌ Deleted Files (Remove Documentation)\n\n`;
    report += `Files that have been deleted - check if documentation needs removal:\n\n`;

    for (const change of deleted.sort((a, b) => a.path.localeCompare(b.path))) {
      report += `- [ ] \`${change.path}\` (remove docs)\n`;
    }
    report += '\n';
  }

  report += `## File Statistics\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Changes | ${added.length + modified.length + deleted.length} |\n`;
  report += `| New Files | ${added.length} |\n`;
  report += `| Modified Files | ${modified.length} |\n`;
  report += `| Deleted Files | ${deleted.length} |\n\n`;

  report += `---\n\n`;
  report += `**How to use this list:**\n\n`;
  report += `1. Check off files as you update documentation\n`;
  report += `2. For new files, create documentation following the \`content-first\` approach\n`;
  report += `3. For modified files, update existing documentation\n`;
  report += `4. For deleted files, remove corresponding documentation\n`;
  report += `5. Run \`npm run snapshot:create\` again to generate a new baseline\n`;

  return report;
}

function printReport(changes: Change[]): void {
  const added = changes.filter(c => c.type === 'added');
  const modified = changes.filter(c => c.type === 'modified');
  const deleted = changes.filter(c => c.type === 'deleted');

  console.log('\n' + '='.repeat(60));
  console.log('📊 CODEBASE CHANGES REPORT');
  console.log('='.repeat(60) + '\n');

  console.log(`📈 Summary:`);
  console.log(`  • Added:    ${added.length} files`);
  console.log(`  • Modified: ${modified.length} files`);
  console.log(`  • Deleted:  ${deleted.length} files\n`);

  if (added.length > 0) {
    console.log(`🆕 New Files (Need Documentation):`);
    const codeFiles = added.filter(c => {
      const ext = c.path.split('.').pop();
      return ['tsx', 'ts', 'jsx', 'js', 'lua', 'py'].includes(ext || '');
    });
    for (const change of codeFiles.slice(0, 10)) {
      const lines = change.details?.newLines ? ` (${change.details.newLines} lines)` : '';
      console.log(`  ✓ ${change.path}${lines}`);
    }
    if (codeFiles.length > 10) {
      console.log(`  ... and ${codeFiles.length - 10} more\n`);
    } else {
      console.log('');
    }
  }

  if (modified.length > 0) {
    console.log(`📝 Modified Files (Check Documentation):`);
    const significant = modified
      .filter(c => Math.abs((c.details?.linesAdded || 0) + (c.details?.linesRemoved || 0)) > 10)
      .slice(0, 10);

    for (const change of significant) {
      const added = change.details?.linesAdded || 0;
      const removed = change.details?.linesRemoved || 0;
      console.log(`  ✏️  ${change.path} (+${added} -${removed})`);
    }
    if (significant.length === 0 && modified.length > 0) {
      console.log(`  (All changes < 10 lines - minor edits)\n`);
    } else {
      console.log('');
    }
  }

  if (deleted.length > 0) {
    console.log(`❌ Deleted Files (Remove Documentation):`);
    for (const change of deleted.slice(0, 10)) {
      console.log(`  ✗ ${change.path}`);
    }
    if (deleted.length > 10) {
      console.log(`  ... and ${deleted.length - 10} more\n`);
    } else {
      console.log('');
    }
  }

  console.log(`📄 Full report saved to: ${DOCS_NEEDED}`);
  console.log('='.repeat(60) + '\n');
}

function printStats(snapshot: Snapshot): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SNAPSHOT STATISTICS');
  console.log('='.repeat(60) + '\n');

  console.log(`Timestamp: ${snapshot.date}`);
  console.log(`Total Files: ${snapshot.totalFiles}`);
  console.log(`Total Lines: ${snapshot.totalLines.toLocaleString()}`);
  console.log(`Total Size: ${(snapshot.totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('Files by Type:');
  const sorted = Object.entries(snapshot.byExtension)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [ext, stats] of sorted) {
    console.log(
      `  ${ext.padEnd(12)} ${stats.count.toString().padStart(4)} files ` +
      `${stats.lines.toString().padStart(8)} lines ` +
      `${(stats.size / 1024).toFixed(1).padStart(8)} KB`
    );
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Main execution
const command = process.argv[2] || 'create';

try {
  switch (command) {
    case 'create':
      const snapshot = createSnapshot();
      saveSnapshot(snapshot);
      printStats(snapshot);
      break;

    case 'compare':
      const changes = compareSnapshots();
      const report = generateReport(changes);
      writeFileSync(DOCS_NEEDED, report);
      printReport(changes);
      console.log(`\n✓ Report generated: ${DOCS_NEEDED}`);
      break;

    case 'report':
      if (!existsSync(DOCS_NEEDED)) {
        console.log('No report found. Running comparison...');
        const changes = compareSnapshots();
        const report = generateReport(changes);
        writeFileSync(DOCS_NEEDED, report);
        printReport(changes);
      } else {
        const report = readFileSync(DOCS_NEEDED, 'utf-8');
        console.log(report);
      }
      break;

    case 'stats':
      if (!existsSync(LATEST_SNAPSHOT)) {
        console.error('No snapshot found. Run: npx ts-node scripts/codebase-snapshot.ts create');
        process.exit(1);
      }
      const latest: Snapshot = JSON.parse(readFileSync(LATEST_SNAPSHOT, 'utf-8'));
      printStats(latest);
      break;

    case 'history':
      if (!existsSync(SNAPSHOT_HISTORY)) {
        console.error('No history found.');
        process.exit(1);
      }
      const lines = readFileSync(SNAPSHOT_HISTORY, 'utf-8').split('\n').filter(l => l);
      console.log(`\nSnapshot History (${lines.length} snapshots):\n`);
      for (const line of lines.slice(-10)) {
        const snap: Snapshot = JSON.parse(line);
        console.log(`  ${snap.date} - ${snap.totalFiles} files, ${snap.totalLines} lines`);
      }
      console.log('');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('\nUsage:');
      console.error('  npx ts-node scripts/codebase-snapshot.ts create   # Create snapshot');
      console.error('  npx ts-node scripts/codebase-snapshot.ts compare  # Compare & report');
      console.error('  npx ts-node scripts/codebase-snapshot.ts report   # Show latest report');
      console.error('  npx ts-node scripts/codebase-snapshot.ts stats    # Show latest stats');
      console.error('  npx ts-node scripts/codebase-snapshot.ts history  # Show history');
      process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
