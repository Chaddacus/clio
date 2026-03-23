import React, { useState, useEffect } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import WaveformDisplay from './WaveformDisplay';
import AudioDebugPanel from './AudioDebugPanel';
import PerformanceIndicator from '../Performance/PerformanceIndicator';
import toast from 'react-hot-toast';

interface RecorderControlsProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
  className?: string;
  showPerformanceIndicator?: boolean;
}

const RecorderControls: React.FC<RecorderControlsProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  className = '',
  showPerformanceIndicator = true,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recorder = useAudioRecorder({
    onRecordingComplete: (audioBlob) => {
      onRecordingComplete?.(audioBlob);
      onRecordingStop?.();
      toast.success('Recording completed!');
    },
    onError: (error) => {
      toast.error(`Recording error: ${error.message}`);
      console.error('Recording error:', error);
    },
    enablePerformanceManagement: true,
  });

  // Check microphone permission on component mount
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        const permission = await recorder.checkMicrophonePermission();
        setHasPermission(permission);
      } catch (error) {
        console.error('Error checking microphone permission:', error);
        setHasPermission(false);
      }
    };

    checkInitialPermission();
  }, [recorder.checkMicrophonePermission]);

  const handleStartRecording = async () => {
    try {
      // First check if permission is already granted
      const permission = await recorder.checkMicrophonePermission();
      setHasPermission(permission);

      if (!permission) {
        // Show user-friendly message about granting permission
        toast('Requesting microphone access...', {
          icon: '🎤',
          duration: 2000,
        });
      }

      // Always try to start recording - the hook will handle permission requests
      await recorder.startRecording();
      setHasPermission(true); // If we get here, permission was granted
      onRecordingStart?.();
      toast.success('Recording started');
    } catch (error) {
      console.error('[RecorderControls] Start recording error:', error);
      toast.error(`Failed to start recording: ${(error as Error).message}`);
    }
  };

  const handleStopRecording = () => {
    recorder.stopRecording();
    toast.success('Recording stopped');
  };

  const handlePauseRecording = () => {
    recorder.pauseRecording();
    toast('Recording paused');
  };

  const handleResumeRecording = () => {
    recorder.resumeRecording();
    toast('Recording resumed');
  };

  const getRecordingStatusColor = () => {
    if (recorder.isRecording && !recorder.isPaused) {
      return 'text-primary animate-pulse';
    }
    if (recorder.isPaused) {
      return 'text-secondary';
    }
    return 'text-on-surface-variant';
  };

  const getRecordingStatusText = () => {
    if (recorder.isRecording && !recorder.isPaused) {
      return 'Recording...';
    }
    if (recorder.isPaused) {
      return 'Paused';
    }
    return 'Ready to record';
  };

  return (
    <div className={`bg-surface-container-low rounded-lg p-6 ${className}`}>
      {/* Permission Warning */}
      {hasPermission === false && (
        <div className="mb-4 p-4 bg-surface-container-high rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-secondary mr-2" />
            <div className="text-sm text-on-surface">
              <p className="font-medium mb-1">Microphone permission required</p>
              <p className="text-xs text-on-surface-variant">
                Click the microphone icon in your browser's address bar and select "Allow",
                or click "Start Recording" to be prompted for permission.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recording Status */}
      <div className="text-center mb-6">
        <div className={`font-editorial text-xl font-light mb-2 ${getRecordingStatusColor()}`} data-testid="recording-status">
          {getRecordingStatusText()}
        </div>
        <div className="font-editorial text-5xl font-light text-on-surface" data-testid="recording-time">
          {recorder.formatTime(recorder.recordingTime)}
        </div>
      </div>

      {/* Waveform Display */}
      {recorder.isRecording && (
        <div className="mb-6">
          <WaveformDisplay
            audioLevel={recorder.audioLevel}
            isRecording={recorder.isRecording}
            isPaused={recorder.isPaused}
          />
        </div>
      )}

      {/* Audio Level Indicator */}
      {recorder.isRecording && !recorder.isPaused && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider mb-2">
            <span>Audio Level</span>
            <span>{Math.round(recorder.audioLevel * 100)}%</span>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-primary to-primary-container h-1.5 rounded-full transition-all duration-100 ease-out"
              style={{ width: `${recorder.audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Audio Debug Panel */}
      <div className="mb-6">
        <AudioDebugPanel
          audioLevel={recorder.audioLevel}
          isRecording={recorder.isRecording}
          isPaused={recorder.isPaused}
          recordingTime={recorder.recordingTime}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center items-center space-x-4">
        {!recorder.isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={disabled}
            className="flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary to-primary-container hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-surface rounded-full transition-opacity duration-200 btn-record-glow"
            title={disabled ? "Allow microphone access to start recording" : "Start Recording"}
          >
            <MicrophoneIcon className="h-10 w-10" />
          </button>
        ) : (
          <>
            {!recorder.isPaused ? (
              <button
                onClick={handlePauseRecording}
                disabled={disabled}
                className="flex items-center justify-center w-12 h-12 bg-surface-container-high/80 backdrop-blur-xl hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface rounded-full transition-colors duration-200"
                title="Pause Recording"
              >
                <PauseIcon className="h-6 w-6" />
              </button>
            ) : (
              <button
                onClick={handleResumeRecording}
                disabled={disabled}
                className="flex items-center justify-center w-12 h-12 bg-surface-container-high/80 backdrop-blur-xl hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-secondary rounded-full transition-colors duration-200"
                title="Resume Recording"
              >
                <PlayIcon className="h-6 w-6" />
              </button>
            )}

            <button
              onClick={handleStopRecording}
              disabled={disabled}
              className="flex items-center justify-center w-16 h-16 bg-surface-container-high/80 backdrop-blur-xl hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface rounded-full transition-colors duration-200"
              title="Stop Recording"
            >
              <StopIcon className="h-8 w-8" />
            </button>
          </>
        )}
      </div>

      {/* Recording tips and quality info */}
      <div className="mt-6 text-center space-y-2">
        <p className="text-xs text-on-surface-variant">
          {recorder.isRecording
            ? 'Speak clearly into your microphone'
            : disabled
              ? 'Allow microphone access above to enable recording'
              : 'Click the microphone button to start recording'
          }
        </p>

        {/* Quality indicator */}
        <div className="flex items-center justify-center space-x-2 text-xs">
          <span className="text-on-surface-variant uppercase tracking-wider">Quality:</span>
          <span className={`font-medium uppercase tracking-wider ${
            recorder.getPerformanceStatus() === 'good' ? 'text-secondary' :
            recorder.getPerformanceStatus() === 'moderate' ? 'text-primary' : 'text-error'
          }`}>
            {recorder.getQualityDescription()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecorderControls;
