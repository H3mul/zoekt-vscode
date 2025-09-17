import * as vscode from 'vscode';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { ZoektService } from './services/zoektService';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    const zoektService = new ZoektService();
    const searchResultsProvider = new SearchResultsProvider();
    vscode.window.createTreeView('searchResults', { treeDataProvider: searchResultsProvider });

    registerCommands(context, zoektService, searchResultsProvider);
}

export function deactivate() {}