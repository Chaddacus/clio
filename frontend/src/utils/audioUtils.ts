// Helper function to construct proper audio file URLs
export const getAudioFileUrl = (audioFilePath: string): string => {
  if (!audioFilePath) return '';
  
  // If it's already a full URL, return as is
  if (audioFilePath.startsWith('http')) {
    return audioFilePath;
  }
  
  // Get the base URL from environment or use default
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  // Remove /api suffix if present, as audio files are served from media root
  const mediaBaseUrl = baseUrl.replace('/api', '');
  
  // Ensure proper URL construction
  const cleanPath = audioFilePath.startsWith('/') ? audioFilePath : `/${audioFilePath}`;
  const fullUrl = `${mediaBaseUrl}${cleanPath}`;
  
  console.log('[audioUtils] Audio URL construction:', {
    inputPath: audioFilePath,
    baseUrl,
    mediaBaseUrl,
    cleanPath,
    finalUrl: fullUrl
  });
  
  return fullUrl;
};

// Get the best available audio URL from a voice note
export const getVoiceNoteAudioUrl = (note: { audio_url: string | null; audio_file: string }): string | null => {
  // First preference: use audio_url if available
  if (note.audio_url) {
    console.log('[audioUtils] Using audio_url:', note.audio_url);
    return note.audio_url;
  }
  
  // Second preference: construct URL from audio_file
  if (note.audio_file) {
    console.log('[audioUtils] Constructing URL from audio_file:', note.audio_file);
    return getAudioFileUrl(note.audio_file);
  }
  
  console.warn('[audioUtils] No audio URL or file available:', note);
  return null;
};