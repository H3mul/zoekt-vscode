import * as vscode from 'vscode';
import { ZoektService } from './services/zoektService';
import { SearchResult } from './types/zoekt';

const zoektService = new ZoektService();

export function registerCommands(context: vscode.ExtensionContext) {
    const searchCommand = vscode.commands.registerCommand('zoekt.search', async () => {
        const query = await vscode.window.showInputBox({ prompt: 'Enter search query' });
        if (query) {
            const results: SearchResult[] = await zoektService.search(query);
            // Handle displaying results in the UI
            // This could involve using a TreeDataProvider or another method
        }
    });

    context.subscriptions.push(searchCommand);
}