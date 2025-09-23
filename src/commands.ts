import * as vscode from 'vscode';
import { ZoektService } from './services/zoektService';
import { SearchResultsProvider } from './providers/searchResultsProvider';
import { SearchQuery } from './types/search';
import { getGitExtensionApi, getRepoNamesFromGitApi } from './utils/gitUtils';

interface CachedQuery {
    query: string;
    count: number;
    durationMs: number;
    searchAllRepos: boolean;
}

async function performSearch(query: string, zoektService: ZoektService, searchResultsProvider: SearchResultsProvider, context: vscode.ExtensionContext, cachedQueries: CachedQuery[], searchAllRepos: boolean) {
    try {
        let repoList: string[] = [];

        if (!searchAllRepos) {
            repoList = getRepoNamesFromGitApi();
        }

        const searchQuery: SearchQuery = { query: query, repoList: repoList };
        const results = await zoektService.search(searchQuery);
        if (!results?.Result?.Files?.length) {
            vscode.window.showInformationMessage('Zoekt: No results found.');
            searchResultsProvider.setResults({ Result: { Files: [], RepoURLs: {}, LineFragments: {}, DurationMs: 0 } }, 0, searchAllRepos, 0, query);
            return;
        }

        // Count the matches first - before filtering
        const totalMatches = results.Result.Files.reduce((sum, file) => sum + (file.LineMatches ? file.LineMatches.length : 0), 0);

        // Linenumber 0 matches are filename matches, not content - filter them out.
        results.Result.Files.forEach(file =>
            file.LineMatches = file.LineMatches.filter(lm => lm.LineNumber !== 0)
        );

        searchResultsProvider.setResults(results, totalMatches, searchAllRepos, results.Result.DurationMs, query);

        // Update cached queries
        const queryHistorySize = vscode.workspace.getConfiguration('zoekt').get<number>('queryHistorySize', 5);
        const updatedQueries = [{ query: query, count: totalMatches, durationMs: results.Result.DurationMs, searchAllRepos: searchAllRepos }, ...cachedQueries.filter(q => q.query !== query)].slice(0, queryHistorySize);

        await context.workspaceState.update('zoekt.cachedQueries', updatedQueries);
        await context.workspaceState.update('zoekt.searchAllReposSelection', searchAllRepos);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.message);
    } finally {
        await context.workspaceState.update('zoekt.lastQuery', query);
    }
}

export function registerCommands(context: vscode.ExtensionContext, zoektService: ZoektService, searchResultsProvider: SearchResultsProvider) {
    const searchCommand = vscode.commands.registerCommand('zoekt.search', async (initialQuery?: string, initialSearchAllRepos?: boolean) => {
        const apiUrl = vscode.workspace.getConfiguration('zoekt').get<string>('apiUrl');
        if (!apiUrl) {
            vscode.window.showErrorMessage('Zoekt API URL not configured.');
            return;
        }
        zoektService.setApiUrl(apiUrl);

        const cachedQueries: CachedQuery[] = context.workspaceState.get('zoekt.cachedQueries', []);
        const persistedSearchAllRepos = context.workspaceState.get<boolean>('zoekt.searchAllReposSelection', false);
        const lastQuery = context.workspaceState.get<string>('zoekt.lastQuery', '');
        const prepopulateLastQuery = vscode.workspace.getConfiguration('zoekt').get<boolean>('prepopulateLastQuery', true);

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Zoekt Search';
        quickPick.placeholder = 'Enter search query or select a recent one';
        quickPick.items = cachedQueries.map(q => ({
            label: q.query,
            description: `${q.count} hits (${q.durationMs}ms)`,
            iconPath: new vscode.ThemeIcon(q.searchAllRepos ? 'globe' : 'repo'),
        }));
        quickPick.canSelectMany = false;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        let searchAllReposSelection = initialSearchAllRepos ?? persistedSearchAllRepos;
        const gitApi = getGitExtensionApi();
        if (!gitApi || !gitApi.repositories.length) {
            searchAllReposSelection = true; // Default to all repos if not a git project
        }

        // Only prefill quickPick.value if initialQuery is a non-empty string
        if (typeof initialQuery === 'string' && initialQuery.length > 0) {
            quickPick.value = initialQuery;
        } else if (prepopulateLastQuery && lastQuery.length > 0) {
            quickPick.value = lastQuery;
        }

        const updateQuickPickButtons = () => {
            quickPick.buttons = [
                {
                    iconPath: new vscode.ThemeIcon(searchAllReposSelection ? 'globe' : 'repo'),
                    tooltip: searchAllReposSelection ? 'Searching all repositories' : 'Searching current repository',
                },
                {
                    iconPath: new vscode.ThemeIcon('clear-all'),
                    tooltip: 'Clear search history',
                },
            ];
        };

        updateQuickPickButtons();

        quickPick.onDidTriggerButton(async e => {
            if (e.tooltip === 'Clear search history') {
                vscode.commands.executeCommand('zoekt.clearHistory');
                quickPick.items = []; // Clear displayed quickpick items
            } else {
                searchAllReposSelection = !searchAllReposSelection;
                await context.workspaceState.update('zoekt.searchAllReposSelection', searchAllReposSelection);
                updateQuickPickButtons();
            }
        });

        let searchQuery: string | undefined;

        quickPick.onDidAccept(async () => {
            if (quickPick.value) {
                searchQuery = quickPick.value;
            } else if (quickPick.selectedItems.length > 0) {
                searchQuery = quickPick.selectedItems[0].label;
            }
            quickPick.hide();
            if (searchQuery) {
                await performSearch(searchQuery, zoektService, searchResultsProvider, context, cachedQueries, searchAllReposSelection);
                vscode.commands.executeCommand('workbench.view.extension.zoekt-sidebar'); // Focus on the search results window
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

    const dismissResultCommand = vscode.commands.registerCommand('zoekt.dismissResult', (element) => searchResultsProvider.dismissElement(element));

    const dismissAllResultsCommand = vscode.commands.registerCommand('zoekt.dismissAllResults', () => searchResultsProvider.dismissAll());

    const copyRemoteLinkCommand = vscode.commands.registerCommand('zoekt.copyRemoteLink', async (element) => {
        const remoteUrl = await searchResultsProvider.getRemoteUrl(element);
        if (remoteUrl) {
            await vscode.env.clipboard.writeText(remoteUrl);
            vscode.window.showInformationMessage('Zoekt: Remote link copied to clipboard!');
        } else {
            vscode.window.showErrorMessage('Zoekt: Could not get remote link.');
        }
    });

    const searchSelectionCommand = vscode.commands.registerCommand('zoekt.searchSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        let selectedText = '';
        if (editor && !editor.selection.isEmpty) {
            selectedText = editor.document.getText(editor.selection);
        }
        vscode.commands.executeCommand('zoekt.search', selectedText);
    });

    context.subscriptions.push(
        searchCommand,
        collapseAllCommand,
        clearHistoryCommand,
        dismissResultCommand,
        dismissAllResultsCommand,
        copyRemoteLinkCommand,
        searchSelectionCommand
    );
}
