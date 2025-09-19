import * as vscode from 'vscode';
import { ZoektService } from './services/zoektService';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { SearchQuery } from './types/search';
import { getGitExtensionApi, getRepoNamesFromGitApi } from './utils/gitUtils';

interface CachedQuery {
    query: string;
    count: number;
}

async function performSearch(query: string, zoektService: ZoektService, searchResultsProvider: SearchResultsProvider, context: vscode.ExtensionContext, cachedQueries: CachedQuery[], searchAllRepos: boolean) {
    try {
        let repoList: string[] = [];

        if (!searchAllRepos) {
            repoList = getRepoNamesFromGitApi();
        }

        const searchQuery: SearchQuery = { query: query, repoList: repoList };
        const results = await zoektService.search(searchQuery);
        if (!results || !results.Result || results.Result.Files.length === 0) {
            vscode.window.showInformationMessage('Zoekt: No results found.');
            searchResultsProvider.setResults({ Result: { Files: [], RepoURLs: {}, LineFragments: {} } }, 0, searchAllRepos);
            return;
        }
        
        const totalMatches = results.Result.Files.reduce((sum, file) => sum + (file.LineMatches ? file.LineMatches.length : 0), 0);
        searchResultsProvider.setResults(results, totalMatches, searchAllRepos);

        // Update cached queries
        const queryHistorySize = vscode.workspace.getConfiguration('zoekt').get<number>('queryHistorySize', 5);
        const updatedQueries = [{ query: query, count: totalMatches }, ...cachedQueries.filter(q => q.query !== query)].slice(0, queryHistorySize); // Keep last 'queryHistorySize' queries

        await context.workspaceState.update('zoekt.cachedQueries', updatedQueries);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.message);
    }
}

export function registerCommands(context: vscode.ExtensionContext, zoektService: ZoektService, searchResultsProvider: SearchResultsProvider) {
    const searchCommand = vscode.commands.registerCommand('zoekt.search', async () => {
        const apiUrl = vscode.workspace.getConfiguration('zoekt').get<string>('apiUrl');
        if (!apiUrl) {
            vscode.window.showErrorMessage('Zoekt API URL not configured.');
            return;
        }
        zoektService.setApiUrl(apiUrl);

        const cachedQueries: CachedQuery[] = context.workspaceState.get('zoekt.cachedQueries', []);

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Zoekt Search';
        quickPick.placeholder = 'Enter search query or select a recent one';
        quickPick.items = cachedQueries.map(q => ({ label: q.query, description: `(${q.count} hits)` }));
        quickPick.canSelectMany = false;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        let searchAllRepos = false;
        const gitApi = getGitExtensionApi();
        if (!gitApi || !gitApi.repositories.length) {
            searchAllRepos = true; // Default to all repos if not a git project
        }

        const updateQuickPickButtons = () => {
            quickPick.buttons = [
                {
                    iconPath: new vscode.ThemeIcon(searchAllRepos ? 'globe' : 'repo'),
                    tooltip: searchAllRepos ? 'Searching all repositories' : 'Searching current repository',
                },
            ];
        };

        updateQuickPickButtons();

        quickPick.onDidTriggerButton(e => {
            searchAllRepos = !searchAllRepos;
            updateQuickPickButtons();
        });

        let query: string | undefined;

        quickPick.onDidAccept(async () => {
            if (quickPick.value) {
                query = quickPick.value;
            } else if (quickPick.selectedItems.length > 0) {
                query = quickPick.selectedItems[0].label;
            }
            quickPick.hide();
            if (query) {
                await performSearch(query, zoektService, searchResultsProvider, context, cachedQueries, searchAllRepos);
            }
        });

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    });

    const collapseAllCommand = vscode.commands.registerCommand('zoekt.collapseAll', () => {
        vscode.commands.executeCommand('workbench.actions.treeView.searchResults.collapseAll');
    });

    const clearHistoryCommand = vscode.commands.registerCommand('zoekt.clearHistory', async () => {
        await context.workspaceState.update('zoekt.cachedQueries', []);
        vscode.window.showInformationMessage('Zoekt search history cleared.');
    });

    context.subscriptions.push(searchCommand, collapseAllCommand, clearHistoryCommand);
}
