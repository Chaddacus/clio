import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'react-query';
import { voiceNotesAPI } from '../services/api';
import RecorderControls from '../components/AudioRecorder/RecorderControls';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import RecordingDebugger from '../components/AudioRecorder/RecordingDebugger';
import MicrophonePermission from '../components/AudioRecorder/MicrophonePermission';
import toast from 'react-hot-toast';

const RecordPage: React.FC = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState('');
  const [hasPermission, setHasPermission] = useState(false);

  const createNoteMutation = useMutation(
    (data: { audio_file: File; title?: string }) => {
      return voiceNotesAPI.create(data);
    },
    {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success('Voice note created successfully! Transcription in progress.');
          navigate(`/notes/${response.data.data?.id}`);
        } else {
          console.error('[RecordPage] API returned success=false:', response.data);
          toast.error(response.data.message || 'Failed to create voice note');
        }
      },
      onError: (error: any) => {
        console.error('[RecordPage] Mutation error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
          fullError: error
        });
        toast.error('Failed to create voice note: ' + (error.response?.data?.message || error.message));
      },
    }
  );

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
    setIsRecording(false);
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setAudioBlob(null);
  };

  const handleRecordingStop = () => {
    setIsRecording(false);
  };

  const handleSave = async () => {
    if (!audioBlob) {
      toast.error('No recording to save');
      return;
    }

    const finalTitle = title.trim() || `Recording ${new Date().toLocaleString()}`;

    const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
      type: audioBlob.type,
    });

    createNoteMutation.mutate({
      audio_file: audioFile,
      title: finalTitle,
    });
  };

  const handleDiscard = () => {
    setAudioBlob(null);
    setTitle('');
    toast('Recording discarded');
  };

  const handleStartOver = () => {
    setAudioBlob(null);
    setTitle('');
  };

  const handlePermissionChange = (granted: boolean) => {
    setHasPermission(granted);
    if (granted) {
      toast.success('Microphone access granted! You can now record voice notes.');
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the stream since we're just testing permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Record Voice Note</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Record your thoughts, meetings, or any audio content
        </p>
      </div>

      {/* Debug Section - Temporarily hidden to focus on main controls */}
      {false && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Debug Recording Issue</h2>
          <RecordingDebugger onComplete={handleRecordingComplete} />
        </div>
      )}

      {/* Microphone Permission */}
      <MicrophonePermission
        onPermissionChange={handlePermissionChange}
        onRequestPermission={requestMicrophonePermission}
      />

      {/* Recording Interface */}
      <div className="space-y-6">
        <RecorderControls
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          disabled={createNoteMutation.isLoading || !hasPermission}
        />

        {/* Post-recording options */}
        {audioBlob && !isRecording && (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recording Complete</h3>
            
            {/* Title input */}
            <div>
              <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your note..."
                className="input-primary"
                maxLength={255}
                disabled={createNoteMutation.isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                If left blank, a title will be generated from the transcription
              </p>
            </div>

            {/* Audio preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview
              </label>
              <audio
                controls
                src={URL.createObjectURL(audioBlob)}
                className="w-full"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSave}
                disabled={createNoteMutation.isLoading}
                className="btn-primary flex-1"
              >
                {createNoteMutation.isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save & Transcribe'
                )}
              </button>
              
              <button
                onClick={handleStartOver}
                disabled={createNoteMutation.isLoading}
                className="btn-secondary"
              >
                Record Again
              </button>
              
              <button
                onClick={handleDiscard}
                disabled={createNoteMutation.isLoading}
                className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Recording tips */}
        <div className="card p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Recording Tips
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Allow microphone access</strong> when prompted by your browser</li>
            <li>• Find a quiet environment to minimize background noise</li>
            <li>• Speak clearly and at a normal pace</li>
            <li>• Keep your microphone about 6 inches from your mouth</li>
            <li>• Avoid tapping or rustling sounds during recording</li>
            <li>• You can pause and resume recording as needed</li>
            <li>• Maximum file size is 50MB per recording</li>
          </ul>
        </div>

        {/* Browser compatibility note */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This app requires microphone access and works best in Chrome, Firefox, Safari, and Edge.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecordPage;