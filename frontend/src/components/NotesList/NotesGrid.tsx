import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MicrophoneIcon,
  ClockIcon,
  TagIcon,
  HeartIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { VoiceNoteListItem } from '../../types';
import AudioPlayer from '../AudioPlayer/AudioPlayer';
import { getAudioFileUrl } from '../../utils/audioUtils';

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

interface NotesGridProps {
  notes: VoiceNoteListItem[];
  onNoteClick?: (note: VoiceNoteListItem) => void;
  onFavoriteToggle?: (noteId: number, isFavorite: boolean) => void;
  onDeleteNote?: (noteId: number) => void;
  isLoading?: boolean;
  className?: string;
}

const NotesGrid: React.FC<NotesGridProps> = ({
  notes,
  onNoteClick,
  onFavoriteToggle,
  onDeleteNote,
  isLoading = false,
  className = '',
}) => {
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [expandedTranscriptions, setExpandedTranscriptions] = useState<Set<number>>(new Set());

  const handleFavoriteClick = (e: React.MouseEvent, note: VoiceNoteListItem) => {
    e.stopPropagation();
    onFavoriteToggle?.(note.id, !note.is_favorite);
  };

  const handleDeleteClick = async (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this note?')) {
      setDeletingIds(prev => new Set(prev.add(noteId)));

      try {
        await onDeleteNote?.(noteId);
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(noteId);
          return newSet;
        });
      }
    }
  };

  const toggleTranscriptionExpanded = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    setExpandedTranscriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: VoiceNoteListItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-secondary" />;
      case 'processing':
        return <ArrowPathIcon className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-error" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: VoiceNoteListItem['status']) => {
    switch (status) {
      case 'completed':
        return 'Transcribed';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusTextClass = (status: VoiceNoteListItem['status']) => {
    switch (status) {
      case 'completed':
        return 'text-secondary';
      case 'processing':
        return 'text-primary animate-pulse';
      case 'failed':
        return 'text-error';
      default:
        return 'text-on-surface-variant';
    }
  };

  const formatDuration = (durationStr: string | null): string => {
    if (!durationStr) return '0:00';

    try {
      // Parse duration string (format: "HH:MM:SS" or "MM:SS")
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) {
        const [hours, minutes, seconds] = parts;
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      return durationStr;
    } catch {
      return '0:00';
    }
  };

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-surface-container-low rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-surface-container-high rounded mb-2" />
            <div className="h-3 bg-surface-container-high rounded w-3/4 mb-4" />
            <div className="flex items-center space-x-4 text-sm">
              <div className="h-3 bg-surface-container-high rounded w-16" />
              <div className="h-3 bg-surface-container-high rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`text-center py-16 ${className}`}>
        <MicrophoneIcon className="h-12 w-12 text-on-surface-variant/30 mx-auto mb-4" aria-hidden="true" />
        <h3 className="font-editorial text-xl font-light text-on-surface mb-2">
          No voice notes yet
        </h3>
        <p className="text-on-surface-variant text-sm mb-6">
          Start recording your first voice note to get started
        </p>
        <a
          href="/record"
          className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-full text-surface bg-gradient-to-r from-primary to-primary-container hover:opacity-90 transition-opacity"
        >
          <MicrophoneIcon className="h-4 w-4 mr-2" />
          Record your first note
        </a>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onNoteClick?.(note)}
          className={`bg-surface-container-low rounded-lg hover:bg-surface-container-high transition-colors duration-200 cursor-pointer ${
            deletingIds.has(note.id) ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {/* Header */}
          <div className="p-4 pb-2">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-editorial text-lg font-light text-on-surface line-clamp-2 flex-1 mr-2">
                {note.title || 'Untitled Note'}
              </h3>
              <button
                onClick={(e) => handleFavoriteClick(e, note)}
                className="flex-shrink-0 p-1 rounded-full hover:bg-surface-container-highest transition-colors"
              >
                {note.is_favorite ? (
                  <HeartSolidIcon className="h-5 w-5 text-primary" />
                ) : (
                  <HeartIcon className="h-5 w-5 text-on-surface-variant/50" />
                )}
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-1 mb-3">
              {getStatusIcon(note.status)}
              <span className={`text-xs font-medium uppercase tracking-wider ${getStatusTextClass(note.status)}`}>
                {getStatusText(note.status)}
              </span>
            </div>

            {/* Tags */}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-tertiary-container text-on-tertiary"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag.name}
                  </span>
                ))}
                {note.tags.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-surface-container-highest text-on-surface-variant">
                    +{note.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Audio Player - only show for completed recordings with audio */}
          {note.status === 'completed' && note.file_size_mb > 0 && note.audio_file && (
            <div className="px-4 pb-3">
              <AudioPlayer
                audioUrl={getAudioFileUrl(note.audio_file)}
                title={note.title || 'Recording'}
                compact={true}
                className="mb-2"
                durationSeconds={note.duration ? parseDurationToSeconds(note.duration) : undefined}
                data-testid="note-audio-player"
                onLoadError={(error) => {
                  console.error('[NotesGrid] Audio load error for note', note.id, ':', error);
                  console.error('[NotesGrid] Audio file path:', note.audio_file);
                  console.error('[NotesGrid] Constructed URL:', note.audio_file ? getAudioFileUrl(note.audio_file) : 'N/A');
                }}
              />
            </div>
          )}

          {/* Transcription Section */}
          {note.transcription_text && (
            <div className="px-4 pb-3 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Transcription
                </h4>
                <button
                  onClick={(e) => toggleTranscriptionExpanded(e, note.id)}
                  className="text-on-surface-variant hover:text-on-surface"
                  data-testid="transcription-toggle"
                >
                  {expandedTranscriptions.has(note.id) ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div
                className={`text-sm text-on-surface-variant font-sans leading-relaxed transition-all duration-200 ${
                  expandedTranscriptions.has(note.id)
                    ? ''
                    : 'line-clamp-3'
                }`}
                data-testid="transcription-text"
              >
                {note.transcription_text}
              </div>

              {note.transcription_confidence && (
                <div className="mt-2 text-xs text-on-surface-variant/60 uppercase tracking-wider">
                  Confidence: {Math.round(note.transcription_confidence * 100)}%
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
              <div className="flex items-center space-x-3">
                {note.duration && (
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{formatDuration(note.duration)}</span>
                  </div>
                )}

                <div className="flex items-center space-x-1">
                  <DocumentTextIcon className="h-3.5 w-3.5" />
                  <span>{Math.round(note.file_size_mb * 10) / 10}MB</span>
                </div>

                {note.language_detected && note.language_detected !== 'auto' && (
                  <span className="bg-surface-container-highest px-1.5 py-0.5 rounded-sm">
                    {note.language_detected}
                  </span>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => handleDeleteClick(e, note.id)}
                disabled={deletingIds.has(note.id)}
                className="text-on-surface-variant/50 hover:text-error transition-colors p-1 rounded"
                title="Delete note"
              >
                {deletingIds.has(note.id) ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  '×'
                )}
              </button>
            </div>

            <div className="mt-2 text-xs text-on-surface-variant/60 uppercase tracking-wider">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotesGrid;
