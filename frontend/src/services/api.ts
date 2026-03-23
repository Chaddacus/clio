import axios, { AxiosResponse } from 'axios';
import { 
  User, AuthTokens, RegisterData, LoginData, UserProfile,
  VoiceNote, VoiceNoteListItem, CreateVoiceNoteData, UpdateVoiceNoteData,
  Tag, PaginatedResponse, UserStats, TranscriptionResult, ApiResponse,
  VoiceNotesFilters
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send httpOnly cookies with every request
});

// No request interceptor needed — access token is sent via httpOnly cookie automatically

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Don't attempt refresh if we're already on the login/register page
      if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        return Promise.reject(error);
      }

      try {
        // Refresh token is sent via httpOnly cookie automatically
        await api.post('/auth/refresh/');
        return api(originalRequest);
      } catch (refreshError) {
        // Only redirect if not already on login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  register: (data: RegisterData): Promise<AxiosResponse<ApiResponse<{ user: User; tokens: AuthTokens }>>> =>
    api.post('/auth/register/', data),
    
  login: (data: LoginData): Promise<AxiosResponse<AuthTokens>> =>
    api.post('/auth/login/', data),
    
  logout: (refreshToken: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/logout/', { refresh_token: refreshToken }),
    
  refreshToken: (refreshToken: string): Promise<AxiosResponse<{ access: string }>> =>
    api.post('/auth/refresh/', { refresh: refreshToken }),
    
  getProfile: (): Promise<AxiosResponse<ApiResponse<UserProfile>>> =>
    api.get('/auth/profile/'),
    
  updateProfile: (data: Partial<UserProfile>): Promise<AxiosResponse<ApiResponse<UserProfile>>> =>
    api.patch('/auth/profile/', data),
};

// Voice Notes API
export const voiceNotesAPI = {
  list: (filters?: VoiceNotesFilters): Promise<AxiosResponse<PaginatedResponse<VoiceNoteListItem>>> => {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }
    
    return api.get(`/notes/?${params.toString()}`);
  },
  
  create: (data: CreateVoiceNoteData): Promise<AxiosResponse<ApiResponse<VoiceNote>>> => {
    const formData = new FormData();
    formData.append('audio_file', data.audio_file);

    if (data.title) {
      formData.append('title', data.title);
    }

    if (data.tag_ids) {
      data.tag_ids.forEach(id => formData.append('tag_ids', id.toString()));
    }

    return api.post('/notes/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  get: (id: number): Promise<AxiosResponse<VoiceNote>> =>
    api.get(`/notes/${id}/`),
    
  update: (id: number, data: UpdateVoiceNoteData): Promise<AxiosResponse<ApiResponse<VoiceNote>>> =>
    api.patch(`/notes/${id}/`, data),
    
  delete: (id: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/notes/${id}/`),
    
  transcribe: (audioFile: File, language: string = 'auto'): Promise<AxiosResponse<ApiResponse<TranscriptionResult>>> => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    formData.append('language', language);
    
    return api.post('/transcribe/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  retranscribe: (id: number, language: string = 'auto'): Promise<AxiosResponse<ApiResponse<VoiceNote>>> => {
    return api.post(`/notes/${id}/retranscribe/`, { language });
  },
  
  getStats: (): Promise<AxiosResponse<ApiResponse<UserStats>>> =>
    api.get('/stats/'),
};

// Tags API
export const tagsAPI = {
  list: (): Promise<AxiosResponse<Tag[]>> =>
    api.get('/tags/'),
    
  create: (data: { name: string; color: string }): Promise<AxiosResponse<Tag>> =>
    api.post('/tags/', data),
    
  get: (id: number): Promise<AxiosResponse<Tag>> =>
    api.get(`/tags/${id}/`),
    
  update: (id: number, data: Partial<Tag>): Promise<AxiosResponse<Tag>> =>
    api.patch(`/tags/${id}/`, data),
    
  delete: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/tags/${id}/`),
};

export default api;