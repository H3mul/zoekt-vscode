import axios from 'axios';
import { ZoektSearchRequest, ZoektSearchResponse } from '../types/zoekt';
import { FetchFile, SearchQuery } from '../types/search';

export class ZoektService {
    private apiUrl: string = '';

    constructor() {}

    public setApiUrl(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    private async zoektRequest<T extends ZoektSearchResponse>(endpoint: string, payload: any): Promise<T> {
        if (!this.apiUrl) {
            throw new Error('Zoekt API URL not configured.');
        }
        try {
            const startTime = Date.now();
            const response = await axios.post<T>(`${this.apiUrl}${endpoint}`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const endTime = Date.now();
            response.data.Result.DurationMs = endTime - startTime;
            return response.data;
        } catch (error) {
            console.error(`Error fetching from Zoekt API endpoint ${endpoint}:`, error);
            throw new Error('Failed to connect to Zoekt API');
        }
    }

    public async search({query, contextLines, files, matches, repoList}: SearchQuery): Promise<ZoektSearchResponse> {
        let queryString = query;
        if (repoList && repoList.length > 0) {
            const repoQuery = repoList.map(repo => `repo:${repo}`).join(" or ");

            if (repoList.length > 1) {
                queryString += ` (${repoQuery})`;
            }
            else {
                queryString += ` ${repoQuery}`;
            }
        }

        const searchRequest: ZoektSearchRequest = {
            Q: queryString,
            Opts: {
                ChunkMatches: false,
                NumContextLines: contextLines || 1,
                MaxDocDisplayCount: files || 100,
                MaxMatchDisplayCount: matches || 0,

                // These are hardcoded because they're really about bounding the amount
                // of work the zoekt server does, they shouldn't be user configurable.
                ShardMaxMatchCount: 10_000,
                TotalMaxMatchCount: 100_000,
            },
        };
        const response = await this.zoektRequest<ZoektSearchResponse>('/api/search', searchRequest);
        return response;
    }
    public async fetchFile({repo, branch, file}: FetchFile): Promise<ZoektSearchResponse> {
        const searchRequest: ZoektSearchRequest = {
            Q: `repo:^${repo}$ file:^${file}$ branch:${branch}`,
            Opts: {
                Whole: true,
                MaxDocDisplayCount: 1,
            },
        };
        const response = await this.zoektRequest<ZoektSearchResponse>('/api/search', searchRequest);
        return response;
    }
}