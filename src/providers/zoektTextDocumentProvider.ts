import * as vscode from 'vscode';
import { ZoektService } from '../services/zoektService';
import { Buffer } from 'buffer';
import { RemoteFile } from '../types/search';

export class ZoektTextDocumentProvider implements vscode.TextDocumentContentProvider {
    constructor(private zoektService: ZoektService) { }

    // Example URI:  "zoekt-remote://zoekt/package.json?branch=HEAD&repo=github.com/microsoft/vscode"
    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const remoteFile = parseZoektUri(uri);
        if (!remoteFile) {
            return `Error: uri could not be parsed ${uri}`;
        }

        const {repository, branch, fileName} = remoteFile

        if (!repository || !branch || !fileName) {
            return `Error: Invalid zoekt-remote URI. Expected format: zoekt-remote://zoekt/<filepath>?repo=<reponame>&branch=<branch>`;
        }

        try {
            const response = await this.zoektService.fetchFile({ repo: repository, branch, file: fileName });
            if (response.Result?.Files && response.Result.Files.length > 0) {
                const fileContent = response.Result.Files[0].Content;
                if (fileContent) {
                    return Buffer.from(fileContent, 'base64').toString('utf8');
                } else {
                    return `Error: File content is empty for ${uri.toString()}`;
                }
            } else {
                return `Error: File not found in Zoekt: ${uri.toString()}`;
            }
        } catch (error: any) {
            return `Error fetching content from Zoekt: ${error.message}`;
        }
    }
}

export function constructZoektUri(file: RemoteFile): vscode.Uri {
    const params = new URLSearchParams();
    params.append('file', file.fileName);
    params.append('repo', file.repository);
    params.append('version', file.version);
    if (file.branch) params.append('branch', file.branch);
    if (file.lineNumber) params.append('line', String(file.lineNumber));

    return vscode.Uri.parse(`zoekt-remote://zoekt/Zoekt preview ${file.fileName}?${params.toString()}`);
}

export function parseZoektUri(uri: vscode.Uri): RemoteFile | undefined {
    if (uri.scheme !== 'zoekt-remote') {
        return undefined;
    }
    // Parse the URI to extract repo, branch, and file
    const params = new URLSearchParams(uri.query);
    const fileName = params.get('file');
    const version = params.get('version');
    const branch = params.get('branch');
    const repository = params.get('repo');
    const line = params.get('line') ? parseInt(params.get('line')!) : undefined;

    if (!repository || !version || !fileName) {
        return undefined;
    }
    const fileObject:RemoteFile = { repository, fileName, version };
    if (branch) fileObject.branch = branch;
    if (line) fileObject.lineNumber = line;
    return fileObject;
}