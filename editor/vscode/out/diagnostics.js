"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TszDiagnosticProvider = void 0;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
class TszDiagnosticProvider {
    constructor() {
        this.running = new Map();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('tsz');
    }
    lint(document) {
        const filePath = document.uri.fsPath;
        if (!filePath.endsWith('.tsz'))
            return;
        // Cancel previous run for this file
        const prev = this.running.get(filePath);
        if (prev)
            prev.kill();
        // Find the compiler — look for tsz/zig-out/bin/zigos-compiler relative to workspace
        const compiler = this.findCompiler(filePath);
        if (!compiler)
            return;
        const proc = cp.execFile(compiler, ['check', filePath], { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            this.running.delete(filePath);
            const output = stderr + '\n' + stdout;
            const diagnostics = this.parseOutput(output, document);
            this.diagnosticCollection.set(document.uri, diagnostics);
        });
        this.running.set(filePath, proc);
    }
    clear(uri) {
        this.diagnosticCollection.delete(uri);
    }
    findCompiler(filePath) {
        // Walk up from file to find zig-out/bin/zigos-compiler
        let dir = path.dirname(filePath);
        for (let i = 0; i < 10; i++) {
            const candidate = path.join(dir, 'zig-out', 'bin', 'zigos-compiler');
            try {
                cp.execFileSync('test', ['-x', candidate]);
                return candidate;
            }
            catch {
                // not found, go up
            }
            const parent = path.dirname(dir);
            if (parent === dir)
                break;
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
                }
                catch {
                    // not found
                }
            }
        }
        return null;
    }
    parseOutput(output, document) {
        const diagnostics = [];
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
            if (!file.endsWith(fileName))
                continue;
            const range = new vscode.Range(Math.max(0, line), Math.max(0, col), Math.max(0, line), 1000);
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
                const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), failMatch[1], vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'tsz';
                diagnostics.push(diagnostic);
            }
        }
        return diagnostics;
    }
    dispose() {
        this.running.forEach((proc) => proc.kill());
        this.running.clear();
        this.diagnosticCollection.dispose();
    }
}
exports.TszDiagnosticProvider = TszDiagnosticProvider;
//# sourceMappingURL=diagnostics.js.map