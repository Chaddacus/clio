import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { voiceNotesAPI } from '../services/api';
import { VoiceNoteListItem } from '../types';
import NotesGrid from '../components/NotesList/NotesGrid';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    is_favorite: undefined,
    ordering: '-created_at',
  });

  const { data: notesData, isLoading, refetch } = useQuery(
    ['voice-notes', filters],
    () => voiceNotesAPI.list(filters),
    {
      onError: () => {
        toast.error('Failed to load voice notes');
      },
    }
  );

  const { data: statsData } = useQuery(
    ['user-stats'],
    () => voiceNotesAPI.getStats(),
    {
      onError: () => {
        toast.error('Failed to load statistics');
      },
    }
  );

  const handleNoteClick = (note: VoiceNoteListItem) => {
    navigate(`/notes/${note.id}`);
  };

  const handleFavoriteToggle = async (noteId: number, isFavorite: boolean) => {
    try {
      await voiceNotesAPI.update(noteId, { is_favorite: isFavorite });
      toast.success(isFavorite ? 'Added to favorites' : 'Removed from favorites');
      refetch();
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await voiceNotesAPI.delete(noteId);
      toast.success('Note deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const stats = statsData?.data.data;
  const notes = notesData?.data.results || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-4xl font-light text-on-surface">Dashboard</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage your voice notes</p>
        </div>
        <Link
          to="/record"
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>New Recording</span>
        </Link>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-6">
            <div className="flex flex-col items-start space-y-3">
              <MicrophoneIcon className="h-6 w-6 text-primary" />
              <div>
                <dd className="text-2xl font-medium text-on-surface">
                  {stats.total_notes}
                </dd>
                <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-1">
                  Total Notes
                </dt>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-col items-start space-y-3">
              <div className="h-6 w-6 flex items-center justify-center">
                <span className="text-secondary font-bold text-base">✓</span>
              </div>
              <div>
                <dd className="text-2xl font-medium text-on-surface">
                  {stats.completed_notes}
                </dd>
                <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-1">
                  Completed
                </dt>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-col items-start space-y-3">
              <div className="h-6 w-6 flex items-center justify-center">
                <span className="text-primary font-bold text-base animate-pulse">⟳</span>
              </div>
              <div>
                <dd className="text-2xl font-medium text-on-surface">
                  {stats.processing_notes}
                </dd>
                <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-1">
                  Processing
                </dt>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-col items-start space-y-3">
              <div className="h-6 w-6 flex items-center justify-center">
                <span className="text-primary font-bold text-base">♥</span>
              </div>
              <div>
                <dd className="text-2xl font-medium text-on-surface">
                  {stats.favorite_notes}
                </dd>
                <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-1">
                  Favorites
                </dt>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Usage */}
      {stats && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-editorial text-xl font-light text-on-surface">Storage Usage</h3>
            <span className="text-xs text-on-surface-variant uppercase tracking-wider">
              {stats.storage_used_mb.toFixed(1)} MB / {stats.storage_quota_mb} MB
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary to-primary-container h-2 rounded-full"
              style={{ width: `${Math.min(stats.storage_percentage, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-on-surface-variant uppercase tracking-wider">
            {stats.storage_percentage.toFixed(1)}% used
          </div>
        </div>
      )}

      {/* Notes Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-editorial text-2xl font-light text-on-surface">Recent Notes</h2>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : (
          <NotesGrid
            notes={notes}
            onNoteClick={handleNoteClick}
            onFavoriteToggle={handleFavoriteToggle}
            onDeleteNote={handleDeleteNote}
            isLoading={false}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
