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
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
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
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="flex items-center space-x-4 text-sm">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <MicrophoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
          No voice notes yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Start recording your first voice note to get started
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onNoteClick?.(note)}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 ${
            deletingIds.has(note.id) ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {/* Header */}
          <div className="p-4 pb-2">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1 mr-2">
                {note.title || 'Untitled Note'}
              </h3>
              <button
                onClick={(e) => handleFavoriteClick(e, note)}
                className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {note.is_favorite ? (
                  <HeartSolidIcon className="h-5 w-5 text-red-500" />
                ) : (
                  <HeartIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-1 mb-3">
              {getStatusIcon(note.status)}
              <span className={`text-sm ${
                note.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                note.status === 'processing' ? 'text-blue-600 dark:text-blue-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {getStatusText(note.status)}
              </span>
            </div>

            {/* Tags */}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      borderColor: tag.color,
                      borderWidth: '1px',
                    }}
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag.name}
                  </span>
                ))}
                {note.tags.length > 3 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
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
            <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Transcription
                </h4>
                <button
                  onClick={(e) => toggleTranscriptionExpanded(e, note.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                className={`text-sm text-gray-600 dark:text-gray-400 transition-all duration-200 ${
                  expandedTranscriptions.has(note.id) 
                    ? '' 
                    : 'line-clamp-3'
                }`}
                data-testid="transcription-text"
              >
                {note.transcription_text}
              </div>
              
              {note.transcription_confidence && (
                <div className="mt-2 text-xs text-gray-500">
                  Confidence: {Math.round(note.transcription_confidence * 100)}%
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-4">
                {note.duration && (
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>{formatDuration(note.duration)}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-1">
                  <DocumentTextIcon className="h-4 w-4" />
                  <span>{Math.round(note.file_size_mb * 10) / 10}MB</span>
                </div>
                
                {note.language_detected && note.language_detected !== 'auto' && (
                  <span className="uppercase text-xs font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                    {note.language_detected}
                  </span>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => handleDeleteClick(e, note.id)}
                disabled={deletingIds.has(note.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                title="Delete note"
              >
                {deletingIds.has(note.id) ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  '×'
                )}
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotesGrid;