export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  profile: UserProfile;
}

export interface UserProfile {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  preferred_language: string;
  audio_quality: string;
  storage_quota_mb: number;
  storage_used_mb: number;
  storage_percentage: number;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface RegisterData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TranscriptionSegment {
  id: number;
  start_time: number;
  end_time: number;
  duration: number;
  text: string;
  confidence: number | null;
  speaker_id: string;
}

export interface VoiceNote {
  id: number;
  title: string;
  transcription: string;
  username: string;
  audio_file: string;
  audio_url: string | null;
  duration: string | null;
  file_size_mb: number;
  language_detected: string;
  confidence_score: number | null;
  status: 'processing' | 'completed' | 'failed';
  error_message: string;
  is_favorite: boolean;
  tags: Tag[];
  segments: TranscriptionSegment[];
  created_at: string;
  updated_at: string;
}

export interface VoiceNoteListItem {
  id: number;
  title: string;
  username: string;
  status: 'processing' | 'completed' | 'failed';
  duration: string | null;
  file_size_mb: number;
  language_detected: string;
  confidence_score: number | null;
  is_favorite: boolean;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  audio_file?: string; // URL path to audio file
  transcription_text?: string;
  transcription_confidence?: number;
}

export interface CreateVoiceNoteData {
  audio_file: File;
  title?: string;
  tag_ids?: number[];
}

export interface UpdateVoiceNoteData {
  title?: string;
  transcription?: string;
  is_favorite?: boolean;
  tag_ids?: number[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserStats {
  total_notes: number;
  completed_notes: number;
  processing_notes: number;
  failed_notes: number;
  favorite_notes: number;
  total_duration_seconds: number;
  languages_used: string[];
  storage_used_mb: number;
  storage_quota_mb: number;
  storage_percentage: number;
}

export interface TranscriptionResult {
  transcription: string;
  language: string;
  duration: number;
  confidence: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioLevel: number;
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
}

export interface AudioVisualizationData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  averageFrequency: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export type Language = 
  | 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' 
  | 'it-IT' | 'pt-PT' | 'ja-JP' | 'ko-KR' | 'zh-CN';

export type AudioQuality = 'low' | 'medium' | 'high';

export type SortField = 'created_at' | 'updated_at' | 'title' | 'duration';

export type SortDirection = 'asc' | 'desc';

export interface VoiceNotesFilters {
  search?: string;
  status?: VoiceNote['status'];
  language_detected?: string;
  is_favorite?: boolean;
  tags?: number[];
  ordering?: string;
  page?: number;
  page_size?: number;
}