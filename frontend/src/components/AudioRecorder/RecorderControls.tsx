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
      return 'text-red-500 animate-pulse';
    }
    if (recorder.isPaused) {
      return 'text-yellow-500';
    }
    return 'text-gray-400';
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
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      {/* Permission Warning */}
      {hasPermission === false && (
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Microphone permission required</p>
              <p className="text-xs">
                Click the microphone icon in your browser's address bar and select "Allow", 
                or click "Start Recording" to be prompted for permission.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recording Status */}
      <div className="text-center mb-6">
        <div className={`text-lg font-semibold mb-2 ${getRecordingStatusColor()}`} data-testid="recording-status">
          {getRecordingStatusText()}
        </div>
        <div className="text-3xl font-mono text-gray-700 dark:text-gray-300" data-testid="recording-time">
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
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Audio Level</span>
            <span>{Math.round(recorder.audioLevel * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-100 ease-out"
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
            className="flex items-center justify-center w-16 h-16 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full shadow-lg transition-colors duration-200"
            title={disabled ? "Allow microphone access to start recording" : "Start Recording"}
          >
            <MicrophoneIcon className="h-8 w-8" />
          </button>
        ) : (
          <>
            {!recorder.isPaused ? (
              <button
                onClick={handlePauseRecording}
                disabled={disabled}
                className="flex items-center justify-center w-12 h-12 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full shadow-lg transition-colors duration-200"
                title="Pause Recording"
              >
                <PauseIcon className="h-6 w-6" />
              </button>
            ) : (
              <button
                onClick={handleResumeRecording}
                disabled={disabled}
                className="flex items-center justify-center w-12 h-12 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full shadow-lg transition-colors duration-200"
                title="Resume Recording"
              >
                <PlayIcon className="h-6 w-6" />
              </button>
            )}
            
            <button
              onClick={handleStopRecording}
              disabled={disabled}
              className="flex items-center justify-center w-16 h-16 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full shadow-lg transition-colors duration-200"
              title="Stop Recording"
            >
              <StopIcon className="h-8 w-8" />
            </button>
          </>
        )}
      </div>

      {/* Recording tips and quality info */}
      <div className="mt-6 text-center space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {recorder.isRecording 
            ? 'Speak clearly into your microphone' 
            : disabled 
              ? 'Allow microphone access above to enable recording'
              : 'Click the microphone button to start recording'
          }
        </p>
        
        {/* Quality indicator */}
        <div className="flex items-center justify-center space-x-2 text-xs">
          <span className="text-gray-400">Quality:</span>
          <span className={`font-medium ${
            recorder.getPerformanceStatus() === 'good' ? 'text-green-600' :
            recorder.getPerformanceStatus() === 'moderate' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {recorder.getQualityDescription()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecorderControls;