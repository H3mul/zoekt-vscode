export interface SearchOptions {
    ChunkMatches: boolean;
    NumContextLines: number;
    MaxDocDisplayCount: number;
    MaxMatchDisplayCount: number;
    ShardMaxMatchCount: number;
    TotalMaxMatchCount: number;
}
export interface SearchQuery {
    query: string;
    contextLines?: number;
    files?: number;
    matches?: number;
    repoList?: string[];
}
