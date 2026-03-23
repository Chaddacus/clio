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
      {/* Header — left-aligned to match Dashboard/Profile */}
      <div>
        <h1 className="font-editorial text-4xl font-light text-on-surface mb-2">Record Voice Note</h1>
        <p className="text-on-surface-variant text-sm">
          Record your thoughts, meetings, or any audio content
        </p>
      </div>

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
            <h3 className="font-editorial text-xl font-light text-on-surface">Recording Complete</h3>

            {/* Title input */}
            <div>
              <label htmlFor="note-title" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
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
              <p className="text-xs text-on-surface-variant mt-2">
                If left blank, a title will be generated from the transcription
              </p>
            </div>

            {/* Audio preview */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
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
                className="btn-primary flex-1 justify-center"
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
                className="btn-secondary text-error hover:text-error"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Recording tips */}
        <div className="card p-6">
          <h3 className="font-editorial text-lg font-light text-on-surface mb-3">
            Recording Tips
          </h3>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li><strong className="text-on-surface font-medium">Allow microphone access</strong> when prompted by your browser</li>
            <li>Find a quiet environment to minimize background noise</li>
            <li>Speak clearly and at a normal pace</li>
            <li>Keep your microphone about 6 inches from your mouth</li>
            <li>Avoid tapping or rustling sounds during recording</li>
            <li>You can pause and resume recording as needed</li>
            <li>Maximum file size is 50MB per recording</li>
          </ul>
        </div>

        {/* Browser compatibility note */}
        <div className="text-center">
          <p className="text-xs text-on-surface-variant/60">
            This app requires microphone access and works best in Chrome, Firefox, Safari, and Edge.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecordPage;
