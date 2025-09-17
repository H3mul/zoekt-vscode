import * as vscode from 'vscode';
import * as path from 'path';
import { FileMatch, LineMatch } from '../types/zoekt';
import { Buffer } from 'buffer';

export type LineMatchWithFileName = LineMatch & { fileName: string };

export type ResultEntry = FileMatch | LineMatchWithFileName;

function isFileMatch(element: ResultEntry): element is FileMatch {
    return (element as FileMatch).LineMatches !== undefined;
}
export class SearchResultsProvider implements vscode.TreeDataProvider<ResultEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResultEntry | undefined | null> = new vscode.EventEmitter<ResultEntry | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ResultEntry | undefined | null> = this._onDidChangeTreeData.event;

    private results: FileMatch[] = [];

    constructor() {}

    public getTreeItem(element: ResultEntry): vscode.TreeItem {
        if (isFileMatch(element)) {
            const fileName = path.basename(element.FileName);
            const dirName = path.dirname(element.FileName);

            const treeItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.Expanded);
            treeItem.description = dirName;
            treeItem.tooltip = element.FileName;
            return treeItem;
        } else {
            const treeItem = new vscode.TreeItem(this.makeTreeItemLabel(element), vscode.TreeItemCollapsibleState.None);

            treeItem.tooltip = `${element.fileName}:${element.LineNumber}`;
            return treeItem;
        }
    }

    private makeTreeItemLabel(lineMatch: LineMatch): vscode.TreeItemLabel {
        const decodedLine = Buffer.from(lineMatch.Line, 'base64').toString('utf8');

        let matchStart = lineMatch.LineFragments.reduce((min, fragment) =>
            Math.min(min, fragment.LineOffset), decodedLine.length);

        const ellipsis = '...';
        const ellipsisOffset = 25; // number of chars to show before/after highlight

        const trimStart = Math.max(matchStart - ellipsisOffset, 0);
        let line = decodedLine.substring(trimStart);

        let trimmedOffset = trimStart;
        if (trimStart > 0) {
            line = ellipsis + line;
            trimmedOffset = trimStart - ellipsis.length;
        }

        return {
            label: line,
            highlights: lineMatch.LineFragments.map(f =>
                [f.LineOffset - trimmedOffset, f.LineOffset + f.MatchLength - trimmedOffset])
        };
    }

    public getChildren(element?: ResultEntry | undefined): vscode.ProviderResult<ResultEntry[]> {
        if (element) {
            if (this.isFileMatch(element)) {
                return element.LineMatches.map(lm => ({ ...lm, fileName: element.FileName }));
            }
            return [];
        }
        return this.results;
    }

    public setResults(results: FileMatch[]): void {
        this.results = results;
        this._onDidChangeTreeData.fire(undefined);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    private isFileMatch(element: ResultEntry): element is FileMatch {
        return (element as FileMatch).LineMatches !== undefined;
    }

}