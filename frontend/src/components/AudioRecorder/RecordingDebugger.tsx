import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';

interface RecordingDebuggerProps {
  onComplete?: (blob: Blob) => void;
}

const RecordingDebugger: React.FC<RecordingDebuggerProps> = ({ onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
  };

  const checkPermissions = async () => {
    try {
      addLog('Checking microphone permissions...');
      
      // Check permission status
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      addLog(`Permission status: ${permission.state}`);
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('ERROR: getUserMedia not available');
        return false;
      }
      
      return true;
    } catch (error) {
      addLog(`Permission check error: ${error}`);
      return true; // Continue anyway
    }
  };

  const startRecording = async () => {
    try {
      setLogs([]);
      addLog('Starting recording...');
      
      await checkPermissions();
      
      // Request microphone access
      addLog('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      addLog('Microphone access granted');
      
      // Validate stream
      addLog(`Stream type: ${typeof stream}`);
      addLog(`Stream constructor: ${(stream as any).constructor?.name}`);
      addLog(`Is MediaStream: ${stream instanceof MediaStream}`);
      
      if (!stream) {
        addLog('ERROR: Stream is null or undefined');
        toast.error('Failed to get media stream');
        return;
      }
      
      if (!(stream instanceof MediaStream)) {
        addLog(`ERROR: Invalid stream type: ${typeof stream}`);
        try {
          addLog(`Stream object: ${JSON.stringify(stream, null, 2)}`);
        } catch (e) {
          addLog(`Stream object: [Unable to stringify - ${(e as Error).message}]`);
        }
        toast.error('Invalid media stream type');
        return;
      }
      
      const tracks = stream.getAudioTracks();
      addLog(`Audio tracks count: ${tracks.length}`);
      
      if (tracks.length === 0) {
        addLog('ERROR: No audio tracks in stream');
        toast.error('No audio tracks available');
        return;
      }
      
      addLog(`First track: ${tracks[0].label}, state: ${tracks[0].readyState}`);
      
      streamRef.current = stream;
      
      // Check supported MIME types
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'];
      let supportedType = 'audio/webm';
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedType = type;
          addLog(`Using MIME type: ${type}`);
          break;
        }
      }
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        addLog(`Data available: ${event.data.size} bytes, type: ${event.data.type}`);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        addLog('Recording stopped');
        addLog(`Total chunks: ${chunksRef.current.length}`);
        
        const blob = new Blob(chunksRef.current, { type: supportedType });
        addLog(`Final blob size: ${blob.size} bytes`);
        
        setAudioBlob(blob);
        onComplete?.(blob);
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.onerror = (event) => {
        addLog(`MediaRecorder error: ${(event as any).error}`);
        toast.error('Recording error occurred');
      };
      
      mediaRecorder.onstart = () => {
        addLog('MediaRecorder started');
      };
      
      // Start recording with small chunks for debugging
      mediaRecorder.start(100); // 100ms chunks
      setIsRecording(true);
      addLog('Recording started successfully');
      toast.success('Recording started');
      
    } catch (error) {
      addLog(`Start recording error: ${error}`);
      toast.error(`Failed to start recording: ${(error as Error).message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    addLog('Stop recording requested');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped');
    } else {
      addLog('MediaRecorder not active or not available');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setAudioBlob(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Recording Debugger</h2>
      
      {/* Controls */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={startRecording}
          disabled={isRecording}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>
        
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          Stop Recording
        </button>
        
        <button
          onClick={clearLogs}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Clear Logs
        </button>
      </div>
      
      {/* Audio playback */}
      {audioBlob && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Recorded Audio:</h3>
          <audio 
            controls 
            src={URL.createObjectURL(audioBlob)} 
            className="w-full"
          />
          <p className="text-sm text-gray-600 mt-1">
            Size: {audioBlob.size} bytes, Type: {audioBlob.type}
          </p>
        </div>
      )}
      
      {/* Logs */}
      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
        <h3 className="text-white font-bold mb-2">Debug Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet. Click "Start Recording" to begin.</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecordingDebugger;