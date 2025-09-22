import * as vscode from 'vscode';

export async function getUriForFile(fileName: string): Promise<vscode.Uri | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    // Try to find the file in the workspace folders
    for (const folder of workspaceFolders) {
        const fileUri = vscode.Uri.joinPath(folder.uri, fileName);
        try {
            await vscode.workspace.fs.stat(fileUri);
            return fileUri;
        } catch {
            return null;
        }
    }

    return null;
}