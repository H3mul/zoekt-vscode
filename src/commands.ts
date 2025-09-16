import * as vscode from 'vscode';
import { ZoektService } from './services/zoektService';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { SearchQuery } from './types/zoekt';

export function registerCommands(context: vscode.ExtensionContext, zoektService: ZoektService, searchResultsProvider: SearchResultsProvider) {
    const searchCommand = vscode.commands.registerCommand('zoekt.search', async () => {
        const apiUrl = vscode.workspace.getConfiguration('zoekt').get<string>('apiUrl');
        if (!apiUrl) {
            vscode.window.showErrorMessage('Zoekt API URL not configured.');
            return;
        }
        zoektService.setApiUrl(apiUrl);

        const query = await vscode.window.showInputBox({ prompt: 'Enter search query' });
        if (query) {
            try {
                const searchQuery: SearchQuery = { query: query };
                const results = await zoektService.search(searchQuery);
                searchResultsProvider.setResults(results);
                vscode.window.showInformationMessage(`${results.length} matches found in zoekt search`);
            } catch (error: any) {
                vscode.window.showErrorMessage(error.message);
            }
        }
    });

    context.subscriptions.push(searchCommand);
}