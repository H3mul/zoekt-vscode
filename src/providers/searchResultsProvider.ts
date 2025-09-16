import * as vscode from 'vscode';
import { FileMatch, LineMatch } from '../types/zoekt';

type TreeItem = FileMatch | LineMatch;

export class SearchResultsProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null> = new vscode.EventEmitter<TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null> = this._onDidChangeTreeData.event;

    private results: FileMatch[] = [];

    constructor() {}

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public getTreeItem(element: TreeItem): vscode.TreeItem {
        if ('LineNumber' in element) { // LineMatch
            const treeItem = new vscode.TreeItem(element.Line.trim());
            treeItem.command = {
                command: 'vscode-zoekt-extension.openFile',
                title: 'Open File',
                arguments: [(this.results.find(r => r.LineMatches.includes(element)) as FileMatch).FileName, element.LineNumber]
            };
            return treeItem;
        } else { // FileMatch
            const treeItem = new vscode.TreeItem(element.FileName, vscode.TreeItemCollapsibleState.Expanded);
            return treeItem;
        }
    }

    public getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
        if (element) {
            if ('LineMatches' in element) {
                return element.LineMatches;
            }
            return [];
        }
        return this.results;
    }

    public setResults(results: FileMatch[]): void {
        this.results = results;
        this.refresh();
    }
}