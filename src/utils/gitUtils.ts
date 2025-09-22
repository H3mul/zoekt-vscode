import * as vscode from 'vscode';

export function getGitExtensionApi(): any | undefined {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    return gitExtension?.exports.getAPI(1);
}

export function getRepositoryFromUri(uri: vscode.Uri): any | undefined {
    const api = getGitExtensionApi();
    if (!api) {
        return undefined;
    }
    return api.getRepository(uri);
}

/**
 * Extract zoekt repo name from Git remote fetch URL formats
 * eg, git@github.com:owner/repo.git and https://github.com/owner/repo.git
 * should both result in github.com/owner/repo
 */
export function getRepoNameFromRemoteUrl(remoteUrl: string): string | undefined {
    try {
        const url = new URL(remoteUrl);
        return url.hostname + url.pathname.replace(/\.git$/, '');
    } catch (e) {
        // Handle SSH format like git@github.com:owner/repo.git
        const urlMatch = remoteUrl.match(/^(?:(?:ssh:\/\/)?git@)?([^:\/]+)[:\/]((\/?[^\/]+)\/([^\/]+?))(?:\.git)?$/);
        if (urlMatch) {
            return `${urlMatch[1]}/${urlMatch[2]}`;
        }
    }
    return undefined;
}

export function getRepoNamesFromGitApi(): string[] {
    const repoList: string[] = [];
    const api = getGitExtensionApi();
    if (api && api.repositories.length > 0) {
        for (const repository of api.repositories) {
            for (const remote of repository.state.remotes) {
                if (remote.fetchUrl) {
                    const repoName = getRepoNameFromRemoteUrl(remote.fetchUrl);
                    if (repoName) {
                        repoList.push(repoName);
                    }
                }
            }
        }
    }
    return repoList;
}

export function findTargetRepo(repository: string): any | undefined {
    const api = getGitExtensionApi();
    const repositories = api?.repositories || [];

    return repositories.find((repo: any) => 
        repo.state.remotes.filter((r: any) => r.fetchUrl)
                          .map((r: any) => getRepoNameFromRemoteUrl(r.fetchUrl))
                          .includes(repository)
    );
}
