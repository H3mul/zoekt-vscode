import { VerifyJsonWebKeyInput } from "crypto";

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
    repoList?: string[];
}

export interface ZoektSearchResponse {
    Result: {
        Files: FileMatch[];
        RepoURLs: Map<RepoName, ZoektTemplate>;
        LineFragments: Map<RepoName, ZoektTemplate>;
    };
}

export interface FileMatch {
    FileName: string;
    Repository: RepoName;
    Version: Version;
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
