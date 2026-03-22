import * as vscode from 'vscode';
import { TszDiagnosticProvider } from './diagnostics';

let diagnosticProvider: TszDiagnosticProvider;

export function activate(context: vscode.ExtensionContext) {
  diagnosticProvider = new TszDiagnosticProvider();
  context.subscriptions.push(diagnosticProvider);

  // Run diagnostics on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
        diagnosticProvider.lint(doc);
      }
    })
  );

  // Run diagnostics on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
        diagnosticProvider.lint(doc);
      }
    })
  );

  // Clear diagnostics when file is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticProvider.clear(doc.uri);
    })
  );

  // Lint all open .tsz files on activation
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.languageId === 'tsz' || doc.fileName.endsWith('.tsz')) {
      diagnosticProvider.lint(doc);
    }
  });
}

export function deactivate() {
  if (diagnosticProvider) {
    diagnosticProvider.dispose();
  }
}
