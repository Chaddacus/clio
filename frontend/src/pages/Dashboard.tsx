import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, MicrophoneIcon, CheckCircleIcon, ArrowPathIcon, HeartIcon, FolderIcon } from '@heroicons/react/24/outline';
import { voiceNotesAPI, foldersAPI } from '../services/api';
import { VoiceNoteListItem } from '../types';
import NotesGrid from '../components/NotesList/NotesGrid';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters] = useState({
    search: '',
    status: undefined,
    is_favorite: undefined,
    ordering: '-created_at',
  });
  const [selectedFolder, setSelectedFolder] = useState<number | 'all' | 'unfiled'>('all');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: foldersData, refetch: refetchFolders } = useQuery(
    ['folders'],
    () => foldersAPI.list(),
    { onError: () => toast.error('Failed to load folders') }
  );
  const folders = foldersData?.data || [];

  const noteFilters = {
    ...filters,
    ...(typeof selectedFolder === 'number' ? { folder: selectedFolder } : {}),
    ...(selectedFolder === 'unfiled' ? { unfiled: true } : {}),
  };

  const { data: notesData, isLoading, refetch } = useQuery(
    ['voice-notes', noteFilters],
    () => voiceNotesAPI.list(noteFilters),
    {
      onError: () => {
        toast.error('Failed to load voice notes');
      },
    }
  );

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await foldersAPI.create({ name });
      setNewFolderName('');
      setShowNewFolder(false);
      refetchFolders();
      toast.success('Folder created');
    } catch (error) {
      toast.error('Failed to create folder');
    }
  };

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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-4xl font-light text-on-surface">Dashboard</h1>
          <p className="font-editorial text-lg italic text-on-surface-variant/70 mt-1">
            Welcome back{user?.username ? `, ${user.username}` : ''}
          </p>
        </div>
        <Link
          to="/record"
          className="btn-primary flex items-center space-x-2"
          aria-label="Start a new recording"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
          <span>New Recording</span>
        </Link>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-6 text-center">
            <MicrophoneIcon className="h-5 w-5 text-primary mx-auto mb-3" aria-hidden="true" />
            <p className="font-editorial text-4xl font-light text-on-surface" aria-label={`${stats.total_notes} total notes`}>
              {stats.total_notes}
            </p>
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-2">
              Total Notes
            </p>
          </div>

          <div className="card p-6 text-center">
            <CheckCircleIcon className="h-5 w-5 text-secondary mx-auto mb-3" aria-hidden="true" />
            <p className="font-editorial text-4xl font-light text-on-surface" aria-label={`${stats.completed_notes} completed`}>
              {stats.completed_notes}
            </p>
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-2">
              Completed
            </p>
          </div>

          <div className="card p-6 text-center">
            <ArrowPathIcon className={`h-5 w-5 text-primary mx-auto mb-3 ${stats.processing_notes > 0 ? 'animate-spin' : ''}`} aria-hidden="true" />
            <p className="font-editorial text-4xl font-light text-on-surface" aria-label={`${stats.processing_notes} processing`}>
              {stats.processing_notes}
            </p>
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-2">
              Processing
            </p>
          </div>

          <div className="card p-6 text-center">
            <HeartIcon className="h-5 w-5 text-primary mx-auto mb-3" aria-hidden="true" />
            <p className="font-editorial text-4xl font-light text-on-surface" aria-label={`${stats.favorite_notes} favorites`}>
              {stats.favorite_notes}
            </p>
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mt-2">
              Favorites
            </p>
          </div>
        </div>
      )}

      {/* Storage Usage — integrated card */}
      {stats && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Storage Usage
            </span>
            <span className="text-xs text-on-surface-variant uppercase tracking-wider">
              {stats.storage_used_mb.toFixed(1)} MB / {stats.storage_quota_mb} MB
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-primary to-primary-container h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.storage_percentage, 100)}%` }}
              role="progressbar"
              aria-valuenow={stats.storage_percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Storage: ${stats.storage_percentage.toFixed(1)}% used`}
            />
          </div>
        </div>
      )}

      {/* Folder filter */}
      <section aria-label="Folders">
        <div className="flex items-center gap-2 flex-wrap">
          <FolderIcon className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
          {([
            { key: 'all', label: 'All' },
            { key: 'unfiled', label: 'Unfiled' },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedFolder(item.key)}
              aria-pressed={selectedFolder === item.key}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedFolder === item.key
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70'
              }`}
            >
              {item.label}
            </button>
          ))}

          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              aria-pressed={selectedFolder === folder.id}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                selectedFolder === folder.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: folder.color }} aria-hidden="true" />
              {folder.parent ? `↳ ${folder.name}` : folder.name}
            </button>
          ))}

          {showNewFolder ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                maxLength={100}
                className="px-3 py-1.5 text-sm rounded-full bg-surface border border-outline/40 focus:outline-none focus:border-primary"
              />
              <button onClick={handleCreateFolder} className="px-3 py-1.5 text-sm rounded-full bg-primary text-on-primary">
                Add
              </button>
            </span>
          ) : (
            <button
              onClick={() => setShowNewFolder(true)}
              className="px-3 py-1.5 text-sm rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70 flex items-center gap-1"
              aria-label="Create a new folder"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" /> New folder
            </button>
          )}
        </div>
      </section>

      {/* Notes Grid */}
      <section aria-label="Recent voice notes">
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
      </section>
    </div>
  );
};

export default Dashboard;
