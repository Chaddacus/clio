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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your voice notes</p>
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
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MicrophoneIcon className="h-8 w-8 text-primary-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Notes
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.total_notes}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">✓</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Completed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.completed_notes}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">⟳</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Processing
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.processing_notes}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">♥</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Favorites
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.favorite_notes}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Usage */}
      {stats && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Storage Usage</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {stats.storage_used_mb.toFixed(1)} MB / {stats.storage_quota_mb} MB
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full"
              style={{ width: `${Math.min(stats.storage_percentage, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {stats.storage_percentage.toFixed(1)}% used
          </div>
        </div>
      )}

      {/* Notes Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Notes</h2>
          {/* Add filters/search here in future */}
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