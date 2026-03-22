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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const diagnostics_1 = require("./diagnostics");
let diagnosticProvider;
function activate(context) {
    diagnosticProvider = new diagnostics_1.TszDiagnosticProvider();
    context.subscriptions.push(diagnosticProvider);
    // Run diagnostics on save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
            diagnosticProvider.lint(doc);
        }
    }));
    // Run diagnostics on open
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
            diagnosticProvider.lint(doc);
        }
    }));
    // Clear diagnostics when file is closed
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        diagnosticProvider.clear(doc.uri);
    }));
    // Lint all open .tsz files on activation
    vscode.workspace.textDocuments.forEach((doc) => {
        if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
            diagnosticProvider.lint(doc);
        }
    });
}
function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
}
//# sourceMappingURL=extension.js.map