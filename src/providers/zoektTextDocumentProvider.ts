import * as vscode from 'vscode';
import { ZoektService } from '../services/zoektService';
import { Buffer } from 'buffer';

export class ZoektTextDocumentProvider implements vscode.TextDocumentContentProvider {
    constructor(private zoektService: ZoektService) { }

    // Example URI:  "zoekt-remote://zoekt/package.json?branch=HEAD&repo=github.com/microsoft/vscode"
    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const file = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path;
        const params = new URLSearchParams(uri.query);
        const branch = params.get('branch');
        const repo = params.get('repo');

        if (!repo || !branch || !file) {
            return `Error: Invalid zoekt-remote URI. Expected format: zoekt-remote://zoekt/<filepath>?repo=<reponame>&branch=<branch>`;
        }

        try {
            const response = await this.zoektService.fetchFile({ repo, branch, file });
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
