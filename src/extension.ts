import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { ZoektService } from './services/zoektService';

export function activate(context: vscode.ExtensionContext) {
    const zoektService = new ZoektService();
    const searchResultsProvider = new SearchResultsProvider(zoektService);

    vscode.window.registerTreeDataProvider('searchResults', searchResultsProvider);
    registerCommands(context, zoektService, searchResultsProvider);
}

export function deactivate() {}