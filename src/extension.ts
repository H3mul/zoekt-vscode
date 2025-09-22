import * as vscode from 'vscode';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { ZoektService } from './services/zoektService';
import { registerCommands } from './commands';
import { ZoektTextDocumentProvider } from './providers/zoektTextDocumentProvider';

export function activate(context: vscode.ExtensionContext) {
    const zoektService = new ZoektService();
    const searchResultsProvider = new SearchResultsProvider();
    const zoektTextDocumentProvider = new ZoektTextDocumentProvider(zoektService);

    vscode.window.createTreeView('searchResults', { treeDataProvider: searchResultsProvider });

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('zoekt-remote', zoektTextDocumentProvider));

    registerCommands(context, zoektService, searchResultsProvider);
}
