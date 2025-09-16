import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { ZoektService } from './services/zoektService';

export function activate(context: vscode.ExtensionContext) {
    const zoektService = new ZoektService();
    const searchResultsProvider = new SearchResultsProvider();

    vscode.window.registerTreeDataProvider('searchResults', searchResultsProvider);
    registerCommands(context, zoektService, searchResultsProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-zoekt-extension.openFile', (filePath: string, line: number) => {
            const uri = vscode.Uri.file(filePath);
            vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
        })
    );
}

export function deactivate() {}