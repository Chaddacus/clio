import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'react-query';
import { voiceNotesAPI } from '../services/api';
import RecorderControls from '../components/AudioRecorder/RecorderControls';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import MicrophonePermission from '../components/AudioRecorder/MicrophonePermission';
import toast from 'react-hot-toast';

// Keep in sync with backend AUDIO_ALLOWED_FORMATS / validate_audio_format.
const ALLOWED_EXT = ['wav', 'mp3', 'ogg', 'webm', 'm4a'];
const EXT_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
};
const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const MIN_BYTES = 1024;

const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const deriveTitle = (name: string) => name.replace(/\.[^.]+$/, '').slice(0, 255);

const RecordPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage the preview object URL lifecycle so we don't leak blobs.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

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
        toast.error('Failed to create voice note: ' + (error.response?.data?.message || error.message));
      },
    }
  );

  const switchMode = (next: 'record' | 'upload') => {
    if (next === mode) return;
    setMode(next);
    setPendingFile(null);
    setTitle('');
  };

  const handleRecordingComplete = (blob: Blob) => {
    const file = new File([blob], `recording-${Date.now()}.webm`, {
      type: blob.type || 'audio/webm',
    });
    setPendingFile(file);
    setIsRecording(false);
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setPendingFile(null);
  };

  const handleRecordingStop = () => {
    setIsRecording(false);
  };

  // Validate an uploaded file and normalize its MIME type so it passes the
  // backend content-type allowlist (browsers often report '' for .m4a/.ogg).
  const acceptUpload = (file: File): void => {
    const ext = fileExt(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error(`Unsupported file type. Allowed: ${ALLOWED_EXT.join(', ')}`);
      return;
    }
    if (file.size < MIN_BYTES) {
      toast.error('That file is too small to be valid audio.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }
    const mime = EXT_MIME[ext];
    const normalized = file.type === mime ? file : new File([file], file.name, { type: mime });
    setPendingFile(normalized);
    setTitle(deriveTitle(file.name));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptUpload(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptUpload(file);
  };

  const handleSave = async () => {
    if (!pendingFile) {
      toast.error('Nothing to save yet');
      return;
    }
    const finalTitle = title.trim() || `Recording ${new Date().toLocaleString()}`;
    createNoteMutation.mutate({ audio_file: pendingFile, title: finalTitle });
  };

  const handleStartOver = () => {
    setPendingFile(null);
    setTitle('');
  };

  const handleDiscard = () => {
    setPendingFile(null);
    setTitle('');
    toast('Discarded');
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
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-editorial text-4xl font-light text-on-surface mb-2">New Voice Note</h1>
        <p className="text-on-surface-variant text-sm">
          Record audio in your browser or upload an existing clip to transcribe
        </p>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg bg-surface-variant/40 p-1" role="tablist" aria-label="Note source">
        <button
          role="tab"
          aria-selected={mode === 'record'}
          onClick={() => switchMode('record')}
          disabled={createNoteMutation.isLoading || isRecording}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            mode === 'record' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Record
        </button>
        <button
          role="tab"
          aria-selected={mode === 'upload'}
          onClick={() => switchMode('upload')}
          disabled={createNoteMutation.isLoading || isRecording}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            mode === 'upload' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Upload
        </button>
      </div>

      {/* Record mode */}
      {mode === 'record' && (
        <div className="space-y-6">
          {!hasPermission && (
            <MicrophonePermission
              onPermissionChange={handlePermissionChange}
              onRequestPermission={requestMicrophonePermission}
            />
          )}
          <RecorderControls
            onRecordingComplete={handleRecordingComplete}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            disabled={createNoteMutation.isLoading || !hasPermission}
          />
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && !pendingFile && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`card p-10 text-center border-2 border-dashed transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-outline/40'
          }`}
        >
          <p className="text-on-surface mb-1">Drag &amp; drop an audio file here</p>
          <p className="text-xs text-on-surface-variant mb-4">
            {ALLOWED_EXT.join(', ').toUpperCase()} · up to 50MB
          </p>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
            Choose file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a"
            onChange={handleFileInput}
            className="hidden"
            aria-label="Choose an audio file to upload"
          />
        </div>
      )}

      {/* Shared "ready to save" card (record or upload) */}
      {pendingFile && !isRecording && (
        <div className="card p-6 space-y-4">
          <h3 className="font-editorial text-xl font-light text-on-surface">
            {mode === 'upload' ? 'Ready to transcribe' : 'Recording complete'}
          </h3>

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

          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Preview
            </label>
            {previewUrl && <audio controls src={previewUrl} className="w-full" />}
          </div>

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
              {mode === 'upload' ? 'Choose Another' : 'Record Again'}
            </button>

            <button
              onClick={handleDiscard}
              disabled={createNoteMutation.isLoading}
              aria-label="Discard permanently"
              className="btn-secondary text-error hover:text-error"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Mode-specific help */}
      {mode === 'record' ? (
        <div className="card p-6">
          <h3 className="font-editorial text-lg font-light text-on-surface mb-3">Recording Tips</h3>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li><strong className="text-on-surface font-medium">Allow microphone access</strong> when prompted by your browser</li>
            <li>Find a quiet environment to minimize background noise</li>
            <li>Speak clearly and at a normal pace</li>
            <li>Keep your microphone about 6 inches from your mouth</li>
            <li>Maximum file size is 50MB per recording</li>
          </ul>
        </div>
      ) : (
        <div className="card p-6">
          <h3 className="font-editorial text-lg font-light text-on-surface mb-3">Uploading Audio</h3>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li>Supported formats: <strong className="text-on-surface font-medium">{ALLOWED_EXT.join(', ').toUpperCase()}</strong></li>
            <li>Maximum file size is 50MB</li>
            <li>Video files aren&apos;t supported yet — export the audio track first</li>
            <li>Transcription starts automatically after upload</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default RecordPage;
