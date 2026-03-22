import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class TszDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private running: Map<string, cp.ChildProcess> = new Map();

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('tsz');
  }

  lint(document: vscode.TextDocument): void {
    const filePath = document.uri.fsPath;
    if (!filePath.endsWith('.tsz')) return;

    // Cancel previous run for this file
    const prev = this.running.get(filePath);
    if (prev) prev.kill();

    // Find the compiler — look for tsz/zig-out/bin/zigos-compiler relative to workspace
    const compiler = this.findCompiler(filePath);
    if (!compiler) return;

    const proc = cp.execFile(
      compiler,
      ['check', filePath],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        this.running.delete(filePath);
        const output = stderr + '\n' + stdout;
        const diagnostics = this.parseOutput(output, document);
        this.diagnosticCollection.set(document.uri, diagnostics);
      }
    );

    this.running.set(filePath, proc);
  }

  clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  private findCompiler(filePath: string): string | null {
    // Walk up from file to find zig-out/bin/zigos-compiler
    let dir = path.dirname(filePath);
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, 'zig-out', 'bin', 'zigos-compiler');
      try {
        cp.execFileSync('test', ['-x', candidate]);
        return candidate;
      } catch {
        // not found, go up
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // Try workspace root
    const workspaces = vscode.workspace.workspaceFolders;
    if (workspaces) {
      for (const ws of workspaces) {
        const candidate = path.join(ws.uri.fsPath, 'tsz', 'zig-out', 'bin', 'zigos-compiler');
        try {
          cp.execFileSync('test', ['-x', candidate]);
          return candidate;
        } catch {
          // not found
        }
      }
    }

    return null;
  }

  private parseOutput(output: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const fileName = path.basename(document.uri.fsPath);

    // Parse [tsz] diagnostic lines:
    //   filename.tsz:LINE:COL: message
    const lineRegex = /^\s*(?:\[tsz\]\s+)?(\S+\.tsz):(\d+):(\d+):\s*(.+)$/gm;
    let match;

    while ((match = lineRegex.exec(output)) !== null) {
      const file = match[1];
      const line = parseInt(match[2], 10) - 1;
      const col = parseInt(match[3], 10) - 1;
      const message = match[4].trim();

      // Only show diagnostics for this file
      if (!file.endsWith(fileName)) continue;

      const range = new vscode.Range(
        Math.max(0, line), Math.max(0, col),
        Math.max(0, line), 1000
      );

      const severity = message.toLowerCase().includes('error')
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diagnostic = new vscode.Diagnostic(range, message, severity);
      diagnostic.source = 'tsz';
      diagnostics.push(diagnostic);
    }

    // Also catch summary errors like "[tsz] Build failed"
    if (output.includes('Build failed') && diagnostics.length === 0) {
      const failMatch = output.match(/error:\s*(.+)/m);
      if (failMatch) {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          failMatch[1],
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'tsz';
        diagnostics.push(diagnostic);
      }
    }

    return diagnostics;
  }

  dispose(): void {
    this.running.forEach((proc) => proc.kill());
    this.running.clear();
    this.diagnosticCollection.dispose();
  }
}
