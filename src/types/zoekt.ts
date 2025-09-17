export interface SearchResult {
    filePath: string;
    lineNumber: number;
    snippet: string;
    repository: string;
}

export interface SearchOptions {
    ChunkMatches: boolean;
    NumContextLines: number;
    MaxDocDisplayCount: number;
    MaxMatchDisplayCount: number;
    ShardMaxMatchCount: number;
    TotalMaxMatchCount: number;
}

export interface ZoektSearchRequest {
    Q: string;
    RepoIDs?: number[];
    Opts?: SearchOptions;
}

export interface SearchQuery {
    query: string;
    contextLines?: number;
    files?: number;
    matches?: number;
}

export interface ZoektSearchResponse {
    Result: {
        Files: FileMatch[];
    };
}

export interface FileMatch {
    FileName: string;
    Repository: string;
    LineMatches: LineMatch[];
}


export interface LineMatch {
    Line: string;
    LineNumber: number;
    Before: string;
    After: string;
    LineFragments: LineFragment[];
}

export interface LineFragment {
    LineOffset: number;
    Offset: number;
    MatchLength: number;
}
