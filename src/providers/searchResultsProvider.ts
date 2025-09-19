import * as vscode from 'vscode';
import * as path from 'path';
import { FileMatch, LineMatch, ZoektSearchResponse } from '../types/zoekt';
import { Buffer } from 'buffer';
import { getUriForFile } from '../utils/fileUtils';
import { findTargetRepo } from '../utils/gitUtils';
import { evaluateFileUrlTemplate } from '../utils/urlTemplates';

export type LineMatchWithFileRef = LineMatch & { FileName: string, Repository: string, Version: string };

interface SummaryEntry {
    type: 'summary';
}

function getSummaryElement(query: string, searchAllRepos: boolean): SummaryEntry {
    return { type: 'summary' };
}

export type ResultEntry = FileMatch | LineMatchWithFileRef | SummaryEntry;

function isFileMatch(element: ResultEntry): element is FileMatch {
    return (element as FileMatch).LineMatches !== undefined && (element as SummaryEntry).type !== 'summary';
}

function isSummaryEntry(element: ResultEntry): element is SummaryEntry {
    return (element as SummaryEntry).type === 'summary';
}

export class SearchResultsProvider implements vscode.TreeDataProvider<ResultEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResultEntry | undefined | null> = new vscode.EventEmitter<ResultEntry | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ResultEntry | undefined | null> = this._onDidChangeTreeData.event;

    private zoektResponse: ZoektSearchResponse | undefined;
    private totalMatches: number = 0;
    private searchAllRepos: boolean = false;
    private queryDurationMs: number = 0;
    private query: string = '';

    public async getTreeItem(element: ResultEntry): Promise<vscode.TreeItem> {
        if (isSummaryEntry(element)) {
            const icon = this.searchAllRepos ? 'globe' : 'repo';
            const label = `Query Results: ${this.totalMatches} hits (${this.queryDurationMs}ms)`;
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            treeItem.iconPath = new vscode.ThemeIcon(icon);
            treeItem.tooltip = `Query: ${this.query}`;
            treeItem.command = {
                command: 'zoekt.search',
                title: 'Search Zoekt',
                arguments: [this.query, this.searchAllRepos],
            };
            return treeItem;
        } else if (isFileMatch(element)) {
            const fileName = path.basename(element.FileName);
            const dirName = path.dirname(element.FileName);

            const treeItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.Expanded);
            treeItem.description = dirName;
            treeItem.tooltip = this.getDisplayFileName(element);
            const uri = await this.getUriForMatch(element);
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [uri],
            };
            if (this.searchAllRepos && !findTargetRepo(element.Repository)) {
                treeItem.iconPath = new vscode.ThemeIcon('go-to-file');
            }
            return treeItem;
        } else {
            // LineMatch case
            const treeItem = new vscode.TreeItem(this.makeTreeItemLabel(element), vscode.TreeItemCollapsibleState.None);
            treeItem.tooltip = this.getDisplayFileName(element);
            const uri = await this.getUriForMatch(element);
            const args: any[] = [uri];
            if (['file'].includes(uri.scheme)) {
                args.push({ selection: new vscode.Range(element.LineNumber - 1, 0, element.LineNumber - 1, 0) });
            }
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: args,
            };
            return treeItem;
        }
    }

    private async getUriForMatch(match: FileMatch | LineMatchWithFileRef): Promise<vscode.Uri> {
        const repository = match.Repository;
        const fileName = match.FileName;
        const version = match.Version;

        const targetRepo = findTargetRepo(repository);
        if (targetRepo) {
            return vscode.Uri.joinPath(targetRepo.rootUri, fileName);
        }

        const localFileUri = await getUriForFile(fileName);
        if (localFileUri) {
            return localFileUri;
        }

        // TODO: Doesnt work at the moment, needs a deep dive into github repositories extension.
        //       Would be nice.
        // const isGitHubUrl = repository.includes('github.com');
        // if (isGitHubUrl) {
        //     const parts = repository.split('/');
        //     const owner = parts[1];
        //     const repo = parts[2];
        //     const githubUri = `github:/${owner}/${repo}/${fileName}?ref=${version}`;
        //     return vscode.Uri.parse(githubUri);
        // }

        if (this.zoektResponse?.Result?.RepoURLs) {
            const repoUrlTemplate = this.zoektResponse.Result.RepoURLs[repository];
            if (repoUrlTemplate) {
                let fileUrl: string;
                if (!isFileMatch(match) && this.zoektResponse.Result.LineFragments) {
                    const lineFragmentTemplate = this.zoektResponse.Result.LineFragments[repository];
                    fileUrl = evaluateFileUrlTemplate(repoUrlTemplate, version, fileName, lineFragmentTemplate, match.LineNumber);
                } else {
                    fileUrl = evaluateFileUrlTemplate(repoUrlTemplate, version, fileName);
                }
                return vscode.Uri.parse(fileUrl);
            }
        }

        return vscode.Uri.file(fileName);
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
            const summaryElement = getSummaryElement('', false);
            if (this.zoektResponse?.Result?.Files && this.zoektResponse.Result.Files.length > 0 || this.totalMatches > 0) {
                return [summaryElement, ...(this.zoektResponse?.Result?.Files || [])];
            }
            return [summaryElement];
        } else if (isSummaryEntry(element)) {
            return [];
        } else if (isFileMatch(element)) {
            return element.LineMatches.map(lm => ({ ...lm, FileName: element.FileName, Repository: element.Repository, Version: element.Version }));
        }
        return [];
    }

    public setResults(response: ZoektSearchResponse, totalMatches: number, searchAllRepos: boolean, queryDurationMs: number, query: string): void {
        this.zoektResponse = response;
        this.totalMatches = totalMatches;
        this.searchAllRepos = searchAllRepos;
        this.queryDurationMs = queryDurationMs;
        this.query = query;
        this._onDidChangeTreeData.fire(undefined);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    private getDisplayFileName(match: FileMatch | LineMatchWithFileRef): string {
        const isLocalRepo = findTargetRepo(match.Repository);
        if (isFileMatch(match)) {
            return isLocalRepo ? match.FileName : `${match.Repository}/${match.FileName}`;
        } else {
            return isLocalRepo ? `${match.FileName}:${match.LineNumber}` : `${match.Repository}/${match.FileName}:${match.LineNumber}`;
        }
    }
}