import React, { useState } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface TranscriptionEditorProps {
  transcription: string;
  onSave: (newTranscription: string) => void;
  isReadOnly?: boolean;
  className?: string;
}

const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  transcription,
  onSave,
  isReadOnly = false,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(transcription);

  const handleSave = () => {
    onSave(editedText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(transcription);
    setIsEditing(false);
  };

  if (isReadOnly) {
    return (
      <div className={`prose prose-gray dark:prose-invert max-w-none ${className}`}>
        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
          {transcription || 'No transcription available.'}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Edit the transcription..."
          />
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="btn-primary flex items-center space-x-2"
            >
              <CheckIcon className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancel}
              className="btn-secondary flex items-center space-x-2"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Transcription
            </h3>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Edit transcription"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
              {transcription || 'No transcription available.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionEditor;