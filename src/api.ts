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
    id: string;
    version: string;
    status: string;
    created_at: string;
    creator?: string;
    utm_zone?: string;
    mgrs_zone?: string;
    coordinate_system?: string;
    description?: string;
    downloads: Record<string, string>;
}

export interface Stats {
    totalRegions: number;
    totalVersions: number;
    lastUpdated: string | null;
}

export const getLaneletPreviewUrl = (vId: string) => `${API_URL}/previews/${vId}/lanelet`;
export const getPcdPreviewUrl = (vId: string) => `${API_URL}/downloads/${vId}/PCD`;
