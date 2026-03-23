import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface AudioDebugPanelProps {
  audioLevel: number;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
}

const AudioDebugPanel: React.FC<AudioDebugPanelProps> = ({
  audioLevel,
  isRecording,
  isPaused,
  recordingTime
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [speechLog, setSpeechLog] = useState<string[]>([]);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Initialize Web Speech API if available
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const results = Array.from(event.results);
        const transcript = results
          .map(result => result[0].transcript)
          .join(' ');
          
        if (transcript.trim()) {
          const timestamp = new Date().toLocaleTimeString();
          const confidence = results[results.length - 1]?.[0]?.confidence || 0;
          const logEntry = `[${timestamp}] ${transcript} (confidence: ${(confidence * 100).toFixed(1)}%)`;
          
          setSpeechLog(prev => {
            const newLog = [...prev, logEntry];
            return newLog.slice(-20); // Keep only last 20 entries
          });
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setSpeechLog(prev => [...prev, `[ERROR] ${event.error}`]);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Control speech recognition based on recording state
  useEffect(() => {
    if (!recognition) return;

    if (isRecording && !isPaused) {
      try {
        recognition.start();
      } catch (error) {
        // Speech recognition already running or failed to start
      }
    } else {
      try {
        recognition.stop();
      } catch (error) {
        // Speech recognition was not running
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch (error) {
        // Ignore errors on cleanup
      }
    };
  }, [isRecording, isPaused, recognition]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [speechLog]);

  return (
    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Audio Debug Panel
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>Level: {Math.round(audioLevel * 100)}%</span>
            <span>•</span>
            <span>{recordingTime}s</span>
            <span>•</span>
            <div className={`w-2 h-2 rounded-full ${
              isRecording ? (isPaused ? 'bg-yellow-400' : 'bg-red-400') : 'bg-gray-400'
            }`} />
          </div>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
          {/* Audio Metrics */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Audio Level</div>
              <div className="bg-gray-200 dark:bg-gray-700 rounded h-2">
                <div 
                  className="bg-blue-500 h-2 rounded transition-all"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Status</div>
              <div className="font-mono text-gray-700 dark:text-gray-300">
                {isRecording ? (isPaused ? 'PAUSED' : 'RECORDING') : 'STOPPED'}
              </div>
            </div>
          </div>
          
          {/* Speech Recognition Support */}
          <div className="text-xs">
            <div className="text-gray-500 mb-1">Speech Recognition</div>
            <div className={`font-mono ${
              recognition ? 'text-green-600' : 'text-red-600'
            }`}>
              {recognition ? 'SUPPORTED' : 'NOT SUPPORTED'}
            </div>
          </div>
          
          {/* Speech Log */}
          {recognition && (
            <div>
              <div className="text-gray-500 text-xs mb-2">Real-time Speech Log</div>
              <div 
                ref={logRef}
                className="bg-gray-900 text-green-400 font-mono text-xs p-3 rounded h-32 overflow-y-auto"
              >
                {speechLog.length === 0 ? (
                  <div className="text-gray-500">
                    {isRecording ? 'Listening for speech...' : 'Start recording to see speech recognition results'}
                  </div>
                ) : (
                  speechLog.map((entry, index) => (
                    <div key={index} className="mb-1">
                      {entry}
                    </div>
                  ))
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                * Real-time speech recognition for debugging (not used for final transcription)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioDebugPanel;