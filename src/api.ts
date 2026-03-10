import axios from 'axios';

const API_URL = 'http://localhost:6060/api';

export const api = axios.create({
    baseURL: API_URL,
});

export interface Region {
    id: string;
    name: string;
    code: string;
}

export interface MapVersion {
    version: string;
    status: string;
    created_at: string;
    downloads: Record<string, string>;
}
