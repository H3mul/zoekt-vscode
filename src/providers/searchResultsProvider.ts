import * as vscode from 'vscode';
import * as path from 'path';
import { FileMatch, LineMatch } from '../types/zoekt';
import { Buffer } from 'buffer';
import { getGitExtensionApi, findTargetRepo, getUriForFile } from '../utils/git';

export type LineMatchWithFileName = LineMatch & { fileName: string, Repository: string };

interface SummaryEntry {
    type: 'summary';
}

export type ResultEntry = FileMatch | LineMatchWithFileName | SummaryEntry;

function isFileMatch(element: ResultEntry): element is FileMatch {
    return (element as FileMatch).LineMatches !== undefined && (element as SummaryEntry).type !== 'summary';
}

function isSummaryEntry(element: ResultEntry): element is SummaryEntry {
    return (element as SummaryEntry).type === 'summary';
}

export class SearchResultsProvider implements vscode.TreeDataProvider<ResultEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResultEntry | undefined | null> = new vscode.EventEmitter<ResultEntry | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ResultEntry | undefined | null> = this._onDidChangeTreeData.event;

    private results: FileMatch[] = [];
    private totalMatches: number = 0;
    private searchAllRepos: boolean = false;

    public async getTreeItem(element: ResultEntry): Promise<vscode.TreeItem> {
        if (isSummaryEntry(element)) {
            const icon = this.searchAllRepos ? 'globe' : 'repo';
            const label = `${this.totalMatches} hits ${this.searchAllRepos ? '(Searching all repositories)' : '(Current Project)'}`;
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            treeItem.iconPath = new vscode.ThemeIcon(icon);
            return treeItem;
        } else if (isFileMatch(element)) {
            const fileName = path.basename(element.FileName);
            const dirName = path.dirname(element.FileName);

            const treeItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.Expanded);
            treeItem.description = dirName;
            treeItem.tooltip = element.FileName;
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [await this.getUriForFile(element.FileName, element.Repository)],
            };
            return treeItem;
        } else {
            const treeItem = new vscode.TreeItem(this.makeTreeItemLabel(element), vscode.TreeItemCollapsibleState.None);

            treeItem.tooltip = `${element.fileName}:${element.LineNumber}`;
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [await this.getUriForFile(element.fileName, element.Repository), { selection: new vscode.Range(element.LineNumber - 1, 0, element.LineNumber - 1, 0) }],
            };
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
        if (!element) {
            const summaryElement = this.getSummaryElement();
            if (this.results.length > 0 || this.totalMatches > 0) {
                return [summaryElement, ...this.results];
            } else {
                return [summaryElement];
            }
        } else if (isSummaryEntry(element)) {
            return [];
        } else if (this.isFileMatch(element)) {
            return element.LineMatches.map(lm => ({ ...lm, fileName: element.FileName, Repository: element.Repository }));
        }
        return [];
    }

    public setResults(results: FileMatch[], totalMatches: number, searchAllRepos: boolean): void {
        this.results = results;
        this.totalMatches = totalMatches;
        this.searchAllRepos = searchAllRepos;
        this._onDidChangeTreeData.fire(undefined);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    private getSummaryElement(): SummaryEntry {
        return { type: 'summary' };
    }

    private isFileMatch(element: ResultEntry): element is FileMatch {
        return (element as FileMatch).LineMatches !== undefined && (element as SummaryEntry).type !== 'summary';
    }

    private async getUriForFile(fileName: string, repository: string): Promise<vscode.Uri> {
        return getUriForFile(fileName, repository);
    }
}