import * as vscode from 'vscode';
import * as path from 'path';
import { FileMatch, LineFragment, LineMatch, ZoektSearchResponse } from '../types/zoekt';
import { Buffer } from 'buffer';
import { getUriForFile } from '../utils/fileUtils';
import { findTargetRepo } from '../utils/gitUtils';
import { evaluateFileUrlTemplate } from '../utils/urlTemplates';

interface SummaryEntry { type: 'summary'; }
interface WelcomeEntry { type: 'welcome'; message: string; }

function isFileMatch(element: ResultEntry): element is FileMatch {
    return (element as FileMatch).LineMatches !== undefined && (element as SummaryEntry).type !== 'summary';
}

function isWelcomeEntry(element: ResultEntry): element is WelcomeEntry {
    return (element as WelcomeEntry).type === 'welcome';
}

function isSummaryEntry(element: ResultEntry): element is SummaryEntry {
    return (element as SummaryEntry).type === 'summary';
}

function getSummaryElement(): SummaryEntry {
    return { type: 'summary' };
}

export type ResultEntry = FileMatch | LineMatchWithFileRef | SummaryEntry | WelcomeEntry;
export type LineMatchWithFileRef = LineMatch & { FileName: string, Repository: string, Version: string };

export class SearchResultsProvider implements vscode.TreeDataProvider<ResultEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResultEntry | undefined | null> = new vscode.EventEmitter<ResultEntry | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ResultEntry | undefined | null> = this._onDidChangeTreeData.event;

    private zoektResponse: ZoektSearchResponse | undefined;
    private totalMatches: number = 0;
    private searchAllRepos: boolean = false;
    private queryDurationMs: number = 0;
    private query: string = '';
    private hasSearched: boolean = false;

    public async getTreeItem(element: ResultEntry): Promise<vscode.TreeItem> {
        if (isSummaryEntry(element)) {
            const icon = this.searchAllRepos ? 'globe' : 'repo';
            const label = `${this.query}`;
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            const resultStats = `${this.totalMatches} hits (${this.queryDurationMs}ms)`;
            treeItem.iconPath = new vscode.ThemeIcon(icon);
            treeItem.description = resultStats;
            treeItem.tooltip = `Results: ${resultStats}`;
            treeItem.command = {
                command: 'zoekt.search',
                title: 'Search Zoekt',
                arguments: [this.query, this.searchAllRepos],
            };
            treeItem.contextValue = 'summary';
            return treeItem;
        } else if (isWelcomeEntry(element)) {
            const treeItem = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
            treeItem.command = {
                command: 'zoekt.search',
                title: 'Search Zoekt',
                arguments: ['', false], // Empty query, not searching all repos
            };
            treeItem.iconPath = new vscode.ThemeIcon('search');
            treeItem.contextValue = 'welcome';
            return treeItem;
        } else if (isFileMatch(element)) {
            const dirName = path.dirname(element.FileName);

            const uri = await this.getUriForMatch(element);
            const treeItem = new vscode.TreeItem(uri, vscode.TreeItemCollapsibleState.Expanded);
            treeItem.iconPath = vscode.ThemeIcon.File;
            treeItem.description = dirName === '.' ? '' : dirName;
            treeItem.tooltip = this.getDisplayFileName(element);
            treeItem.contextValue = 'fileMatch';
            return treeItem;
        } else {
            // LineMatch case
            const treeItem = new vscode.TreeItem(this.makeTreeItemLabel(element), vscode.TreeItemCollapsibleState.None);
            treeItem.tooltip = this.getDisplayFileName(element);
            const uri = await this.getUriForMatch(element);
            const args: any[] = [uri];
            const [matchStart, matchEnd] = this.getMatchRange(element.LineFragments);
            const lineNumber = Math.max(element.LineNumber - 1, 0);

            if (['file'].includes(uri.scheme)) {
                args.push({ selection: new vscode.Range(lineNumber, matchStart, lineNumber, matchEnd) });
            }
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: args,
            };
            treeItem.contextValue = 'lineMatch';
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

    private getMatchRange(lineFragments: LineFragment[]): [number, number] {
        const matchStart = lineFragments.reduce((min, fragment) =>
            Math.min(min, fragment.LineOffset), Number.MAX_SAFE_INTEGER);
        const matchEnd = lineFragments.reduce((max, fragment) =>
            Math.max(max, fragment.LineOffset + fragment.MatchLength), 0);
        return [matchStart, matchEnd];
    }

    private makeTreeItemLabel(lineMatch: LineMatch): vscode.TreeItemLabel {
        const decodedLine = Buffer.from(lineMatch.Line, 'base64').toString('utf8').trimEnd();

        const [matchStart, _] = this.getMatchRange(lineMatch.LineFragments);

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
            const summaryElement = getSummaryElement();
            if (this.zoektResponse?.Result?.Files && this.zoektResponse.Result.Files.length > 0 || this.totalMatches > 0) {
                return [summaryElement, ...(this.zoektResponse?.Result?.Files || [])];
            } else if (this.hasSearched) {
                return [{ type: 'welcome', message: 'Query had no results. Refine your search.' }];
            } else {
                return [{ type: 'welcome', message: 'Start a Zoekt search to see results here.' }];
            }
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
        this.hasSearched = true;
        this._onDidChangeTreeData.fire(undefined);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public dismissElement(element: ResultEntry): void {
        if (isFileMatch(element)) {
            this.zoektResponse!.Result!.Files = this.zoektResponse!.Result!.Files!.filter(file => file !== element);
        } else if (!isSummaryEntry(element) && !isWelcomeEntry(element)) {
            // It's a LineMatchWithFileRef
            const fileMatch = this.zoektResponse!.Result!.Files!.find(file => file.FileName === element.FileName && file.Repository === element.Repository);
            if (fileMatch) {
                fileMatch.LineMatches = fileMatch.LineMatches.filter(line => line.LineNumber !== element.LineNumber);
                if (fileMatch.LineMatches.length === 0) {
                    this.dismissElement(fileMatch); // Dismiss the file if no line matches are left
                }
            }
        }
        this.totalMatches = this.zoektResponse?.Result?.Files?.reduce((acc, file) => acc + file.LineMatches.length, 0) || 0;
        this._onDidChangeTreeData.fire(undefined);
    }

    public dismissAll(): void {
        this.zoektResponse = undefined;
        this.totalMatches = 0;
        this.queryDurationMs = 0;
        this.query = '';
        this.hasSearched = false;
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