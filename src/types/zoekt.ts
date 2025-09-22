export interface ZoektSearchRequest {
    Q: string;
    Opts?: SearchOptions;
}
export interface SearchOptions {
    Whole?: boolean;
    ChunkMatches?: boolean;
    NumContextLines?: number;
    MaxDocDisplayCount?: number;
    MaxMatchDisplayCount?: number;
    ShardMaxMatchCount?: number;
    TotalMaxMatchCount?: number;
}

export interface ZoektBaseResponse {
    Result: ZoektBaseResult;
}

export interface ZoektBaseResult {
    DurationMs: number;
}

export interface ZoektSearchResult extends ZoektBaseResult {
    Files: FileMatch[];
    RepoURLs: {[key:RepoName]: ZoektTemplate};
    LineFragments: {[key:RepoName]: ZoektTemplate};
}

export interface ZoektSearchResponse extends ZoektBaseResponse {
    Result: ZoektSearchResult;
}

export interface FileMatch {
    FileName: string;
    Repository: RepoName;
    Version: Version;
    Content?: string;
    Branches: string[];
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

// Zoekt repo name - domain + path without .git suffix
export type RepoName = string;

// Template to construct string from constituent variables
export type ZoektTemplate = string;

// Git ref
export type Version = string;
