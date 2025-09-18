import { SearchOptions } from "./search";

export interface ZoektSearchRequest {
    Q: string;
    Opts?: SearchOptions;
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
