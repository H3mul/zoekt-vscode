import * as vscode from 'vscode';
import { SearchResult } from '../types/zoekt';

export class SearchResultsProvider implements vscode.TreeDataProvider<SearchResult> {
    private _onDidChangeTreeData: vscode.EventEmitter<SearchResult | undefined | void> = new vscode.EventEmitter<SearchResult | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SearchResult | undefined | void> = this._onDidChangeTreeData.event;

    private results: SearchResult[] = [];

    constructor() {}

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: SearchResult): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.path);
        treeItem.command = {
            command: 'vscode-zoekt-extension.openFile',
            title: 'Open File',
            arguments: [element.path]
        };
        return treeItem;
    }

    public getChildren(element?: SearchResult): vscode.ProviderResult<SearchResult[]> {
        if (element) {
            return []; // No children for search results
        }
        return this.results;
    }

    public setResults(results: SearchResult[]): void {
        this.results = results;
        this.refresh();
    }
}