import * as vscode from 'vscode';
import * as path from 'path';
import { FileMatch, LineMatch } from '../types/zoekt';
import { Buffer } from 'buffer';

export class SearchResultsProvider implements vscode.TreeDataProvider<FileMatch | LineMatch> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileMatch | undefined | null> = new vscode.EventEmitter<FileMatch | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<FileMatch | undefined | null> = this._onDidChangeTreeData.event;

    private results: FileMatch[] = [];

    constructor() {}

    public getTreeItem(element: FileMatch | LineMatch): vscode.TreeItem {
        if (this.isFileMatch(element)) {
            const fileName = path.basename(element.FileName);
            const dirName = path.dirname(element.FileName);

            const treeItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.Collapsed);
            treeItem.description = dirName;
            return treeItem;
        } else {

            let firstInstance = element.LineFragments.reduce((min, fragment) => fragment.Offset < min ? fragment.Offset : min, element.LineFragments[0].Offset);
            let lastInstance = element.LineFragments.reduce((max, fragment) => fragment.Offset > max ? fragment.Offset : max, element.LineFragments[0].Offset);

            const offset = 50;

            const decodedLine = Buffer.from(element.Line, 'base64').toString('utf8');
            // const { trimmedLine, matchStartInTrimmed, matchEndInTrimmed } = this.trimLine(decodedLine, firstInstance - offset, lastInstance + offset);

            const treeItem = new vscode.TreeItem({
                label: decodedLine.trim(),
                highlights: element.LineFragments.map(f =>
                    [f.LineOffset, f.LineOffset + f.MatchLength]) 
            }, vscode.TreeItemCollapsibleState.None);

            treeItem.description = `:${element.LineNumber}`;
            return treeItem;
        }
    }

    public getChildren(element?: FileMatch | LineMatch | undefined): vscode.ProviderResult<(FileMatch | LineMatch)[]> {
        if (element) {
            if (this.isFileMatch(element)) {
                return element.LineMatches;
            }
            return [];
        }
        return this.results;
    }

    public setResults(results: FileMatch[]): void {
        this.results = results;
        this._onDidChangeTreeData.fire(undefined);
    }

    private isFileMatch(element: FileMatch | LineMatch): element is FileMatch {
        return (element as FileMatch).LineMatches !== undefined;
    }

    // Helper method to trim the line based on match location
    private trimLine(line: string, matchStart: number, matchEnd: number): { trimmedLine: string, matchStartInTrimmed: number, matchEndInTrimmed: number } {
        const maxLen = 100; // Maximum length of the trimmed line
        const ellipsis = '...';

        if (line.length <= maxLen) {
            return { trimmedLine: line, matchStartInTrimmed: matchStart, matchEndInTrimmed: matchEnd };
        }

        let start = Math.max(0, matchStart - maxLen / 2);
        let end = Math.min(line.length, matchEnd + maxLen / 2);

        if (end - start > maxLen) {
            if (matchStart < line.length / 2) {
                end = start + maxLen;
            } else {
                start = end - maxLen;
            }
        }

        let trimmed = line.substring(start, end);
        let matchStartInTrimmed = matchStart - start;
        let matchEndInTrimmed = matchEnd - start;

        if (start > 0) {
            trimmed = ellipsis + trimmed;
            matchStartInTrimmed += ellipsis.length;
            matchEndInTrimmed += ellipsis.length;
        }
        if (end < line.length) {
            trimmed = trimmed + ellipsis;
        }

        return { trimmedLine: trimmed, matchStartInTrimmed, matchEndInTrimmed };
    }
}