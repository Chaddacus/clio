import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { voiceNotesAPI } from '../services/api';
import AudioPlayer from '../components/NoteEditor/AudioPlayer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { getVoiceNoteAudioUrl } from '../utils/audioUtils';
import toast from 'react-hot-toast';

// Helper function to parse Django DurationField string to seconds
const parseDurationToSeconds = (duration: string): number => {
  // Duration format can be "HH:MM:SS", "MM:SS", or just seconds
  // Examples: "00:13:08.123456", "13:08", "788.123456"

  // Handle decimal seconds format (like "788.123456")
  if (!duration.includes(':')) {
    return parseFloat(duration);
  }

  // Handle time format (like "00:13:08" or "13:08")
  const parts = duration.split(':').map(part => parseFloat(part.split('.')[0])); // Remove microseconds

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0; // Fallback
};

const NoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const noteId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [showRetranscribeDialog, setShowRetranscribeDialog] = useState(false);

  const { data: noteData, isLoading, error, refetch } = useQuery(
    ['voice-note', noteId],
    () => voiceNotesAPI.get(noteId),
    {
      enabled: !!noteId,
      onError: () => {
        toast.error('Failed to load voice note');
      },
    }
  );

  const retranscribeMutation = useMutation(
    ({ language }: { language: string }) => voiceNotesAPI.retranscribe(noteId, language),
    {
      onSuccess: () => {
        toast.success('Re-transcription started! This may take a few minutes.');
        refetch(); // Refresh the note data
        setShowRetranscribeDialog(false);
      },
      onError: (error: any) => {
        toast.error(`Re-transcription failed: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const languageOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
  ];

  const handleRetranscribe = () => {
    retranscribeMutation.mutate({ language: selectedLanguage });
  };

  const goBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  if (error || !noteData) {
    return (
      <div className="text-center py-12">
        <h2 className="font-editorial text-2xl font-light text-on-surface mb-2">
          Note not found
        </h2>
        <p className="text-on-surface-variant text-sm">
          The voice note you're looking for doesn't exist or you don't have permission to view it.
        </p>
      </div>
    );
  }

  const note = noteData.data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-on-surface-variant uppercase tracking-wider">
        <button
          onClick={goBackToDashboard}
          className="flex items-center space-x-1 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Dashboard</span>
        </button>
        <span>/</span>
        <span className="text-on-surface">
          {note.title || 'Untitled Note'}
        </span>
      </div>

      {/* Header */}
      <div className="card p-6">
        <h1 className="font-editorial text-3xl font-light text-on-surface mb-3">
          {note.title || 'Untitled Note'}
        </h1>
        <div className="flex items-center space-x-4 text-xs text-on-surface-variant uppercase tracking-wider">
          <span>{new Date(note.created_at).toLocaleDateString()}</span>
          <span>·</span>
          <span>{note.file_size_mb}MB</span>
          {note.duration && (
            <>
              <span>·</span>
              <span>{note.duration}</span>
            </>
          )}
          {note.language_detected && note.language_detected !== 'auto' && (
            <>
              <span>·</span>
              <span>{note.language_detected}</span>
            </>
          )}
        </div>
      </div>

      {/* Audio Player */}
      {(() => {
        const audioUrl = getVoiceNoteAudioUrl(note);

        if (audioUrl) {
          // Convert duration string to seconds for AudioPlayer
          const durationSeconds = note.duration ? parseDurationToSeconds(note.duration) : undefined;

          return (
            <AudioPlayer
              audioUrl={audioUrl}
              segments={note.segments}
              durationSeconds={durationSeconds}
            />
          );
        } else {
          return (
            <div className="card p-6 mb-6">
              <div className="flex items-center space-x-2 text-secondary">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-sm text-on-surface">Audio file not available</p>
                  <p className="text-sm text-on-surface-variant">The audio recording for this note could not be found.</p>
                  <p className="text-xs text-on-surface-variant/50 mt-1">
                    Debug: audio_url={note.audio_url || 'null'}, audio_file={note.audio_file || 'null'}
                  </p>
                </div>
              </div>
            </div>
          );
        }
      })()}

      {/* Transcription */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-editorial text-xl font-light text-on-surface">
            Transcription
          </h2>
          {note.status === 'completed' && (
            <button
              onClick={() => setShowRetranscribeDialog(true)}
              disabled={retranscribeMutation.isLoading}
              className="flex items-center space-x-2 btn-primary text-xs py-1.5 px-4"
            >
              {retranscribeMutation.isLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  <span>Re-transcribing...</span>
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>Re-transcribe</span>
                </>
              )}
            </button>
          )}
        </div>

        {note.status === 'processing' && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="mr-2" />
            <span className="text-on-surface-variant text-sm">
              Transcribing your audio... This may take a few minutes.
            </span>
          </div>
        )}

        {note.status === 'failed' && (
          <div className="text-center py-8">
            <div className="text-error mb-2">
              Transcription failed
            </div>
            {note.error_message && (
              <div className="text-sm text-on-surface-variant mb-4">
                {note.error_message}
              </div>
            )}
            <button
              onClick={() => setShowRetranscribeDialog(true)}
              disabled={retranscribeMutation.isLoading}
              className="btn-primary mx-auto"
            >
              {retranscribeMutation.isLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                  <span>Retrying...</span>
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  <span>Try Again</span>
                </>
              )}
            </button>
          </div>
        )}

        {note.status === 'completed' && (
          <div className="space-y-4">
            {note.transcription ? (
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-on-surface font-sans leading-relaxed">
                  {note.transcription}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-on-surface-variant">
                No transcription available for this note.
              </div>
            )}

            {note.confidence_score && (
              <div className="mt-4 text-xs text-on-surface-variant uppercase tracking-wider">
                Transcription confidence: {Math.round(note.confidence_score * 100)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="card p-6">
          <h3 className="font-editorial text-xl font-light text-on-surface mb-3">
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-3 py-1 rounded-sm text-xs font-medium bg-tertiary-container text-on-tertiary"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Segments */}
      {note.segments.length > 0 && (
        <div className="card p-6">
          <h3 className="font-editorial text-xl font-light text-on-surface mb-3">
            Transcript Segments
          </h3>
          <div className="space-y-3">
            {note.segments.map((segment, index) => (
              <div
                key={segment.id}
                className="flex items-start space-x-3 p-3 bg-surface-container-high rounded-lg"
              >
                <div className="flex-shrink-0 text-xs text-on-surface-variant font-mono uppercase tracking-wider mt-1">
                  {Math.floor(segment.start_time / 60)}:{String(Math.floor(segment.start_time % 60)).padStart(2, '0')}
                </div>
                <div className="flex-1 text-sm text-on-surface font-sans leading-relaxed">
                  {segment.text}
                </div>
                {segment.confidence && (
                  <div className="flex-shrink-0 text-xs text-on-surface-variant uppercase tracking-wider">
                    {Math.round(segment.confidence * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Re-transcribe Dialog */}
      {showRetranscribeDialog && (
        <div className="fixed inset-0 bg-surface/80 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container-highest rounded-lg max-w-md w-full p-6">
            <h3 className="font-editorial text-xl font-light text-on-surface mb-4">
              Re-transcribe Audio
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              This will replace the current transcription. The process may take a few minutes.
            </p>

            <div className="mb-4">
              <label htmlFor="language-select" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                Language
              </label>
              <select
                id="language-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container border-b border-outline-variant/15 text-on-surface focus:outline-none focus:border-secondary transition-colors"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRetranscribeDialog(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRetranscribe}
                disabled={retranscribeMutation.isLoading}
                className="btn-primary"
              >
                {retranscribeMutation.isLoading ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <span>Re-transcribe</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteDetailPage;
