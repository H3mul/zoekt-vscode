export interface SearchResult {
    filePath: string;
    lineNumber: number;
    snippet: string;
    repository: string;
}

export interface QueryParameters {
    query: string;
    limit?: number;
    offset?: number;
    caseSensitive?: boolean;
    fileType?: string;
}