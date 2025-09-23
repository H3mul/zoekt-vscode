export interface SearchQuery {
    query: string;
    contextLines?: number;
    files?: number;
    matches?: number;
    repoList?: string[];
}
export interface FetchFile {
    file: string;
    repo: string;
    branch: string;
}
export interface RemoteFile {
    repository: string;
    fileName: string;
    version: string;
    branch?: string;
    lineNumber?: number;
}