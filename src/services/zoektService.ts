import axios from 'axios';
import { SearchResult, Query } from '../types/zoekt';

export class ZoektService {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    public async search(query: Query): Promise<SearchResult[]> {
        try {
            const response = await axios.post(`${this.apiUrl}/search`, query);
            return response.data.results;
        } catch (error) {
            console.error('Error fetching search results from Zoekt API:', error);
            throw new Error('Failed to fetch search results');
        }
    }
}