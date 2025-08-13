import { useState, useRef, useCallback } from 'react';

interface MinimalRecorderState {
  isRecording: boolean;
  recordingTime: number;
  error: string | null;
}

export const useMinimalRecorder = () => {
  const [state, setState] = useState<MinimalRecorderState>({
    isRecording: false,
    recordingTime: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const logWithTimestamp = useCallback((message: string, type: 'info' | 'error' | 'warn' = 'info') => {
    const now = Date.now();
    const relativeTime = startTimeRef.current ? now - startTimeRef.current : 0;
    const logMessage = `[MinimalRecorder] [+${relativeTime}ms] ${message}`;
    
    if (type === 'error') {
      console.error(logMessage);
    } else if (type === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      startTimeRef.current = Date.now();
      logWithTimestamp('🎤 Starting minimal recording...');
      
      setState(prev => ({ ...prev, error: null }));
      
      // Request microphone access with minimal constraints
      logWithTimestamp('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      logWithTimestamp(`✅ getUserMedia successful - Stream ID: ${stream.id}`);
      logWithTimestamp(`Audio tracks: ${stream.getAudioTracks().length}`);
      
      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder with default settings
      logWithTimestamp('Creating MediaRecorder...');
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      logWithTimestamp(`✅ MediaRecorder created - State: ${mediaRecorder.state}, MIME: ${mediaRecorder.mimeType}`);

      // Set up minimal event handlers
      mediaRecorder.onstart = () => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        logWithTimestamp(`🟢 ONSTART fired after ${elapsed}ms`);
        
        setState(prev => ({ ...prev, isRecording: true, recordingTime: 0 }));
        
        // Start simple timer
        timerRef.current = setInterval(() => {
          setState(prev => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
        }, 1000);
      };

      mediaRecorder.ondataavailable = (event) => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        logWithTimestamp(`📦 Data available: ${event.data.size} bytes at ${elapsed}ms`);
        
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        const duration = (elapsed / 1000).toFixed(2);
        logWithTimestamp(`🔴 ONSTOP fired - Duration: ${duration}s`);
        
        setState(prev => ({ ...prev, isRecording: false }));
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Create final blob
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        logWithTimestamp(`💾 Final recording: ${blob.size} bytes, ${chunksRef.current.length} chunks`);
        
        // Analyze duration
        if (elapsed < 2000) {
          logWithTimestamp(`🚨 PREMATURE STOP: Recording ended after only ${duration}s!`, 'error');
          setState(prev => ({ 
            ...prev, 
            error: `Recording stopped prematurely after ${duration}s` 
          }));
        } else {
          logWithTimestamp(`✅ Normal recording duration: ${duration}s`);
        }

        // Cleanup
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        logWithTimestamp(`❌ MediaRecorder error at ${elapsed}ms: ${(event as any).error}`, 'error');
        
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          error: `Recording error: ${(event as any).error}` 
        }));
        
        cleanup();
      };

      // Start recording with basic configuration
      logWithTimestamp(`Starting MediaRecorder... (state: ${mediaRecorder.state})`);
      mediaRecorder.start(250); // 250ms timeslices
      
      logWithTimestamp(`MediaRecorder.start() called (state: ${mediaRecorder.state})`);
      
      // Monitor state transitions
      setTimeout(() => logWithTimestamp(`State after 100ms: ${mediaRecorder.state}`), 100);
      setTimeout(() => logWithTimestamp(`State after 500ms: ${mediaRecorder.state}`), 500);
      setTimeout(() => logWithTimestamp(`State after 1000ms: ${mediaRecorder.state}`), 1000);
      setTimeout(() => logWithTimestamp(`State after 2000ms: ${mediaRecorder.state}`), 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`❌ Recording setup failed: ${errorMessage}`, 'error');
      
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        error: `Setup failed: ${errorMessage}` 
      }));
      
      cleanup();
    }
  }, [logWithTimestamp]);

  const stopRecording = useCallback(() => {
    logWithTimestamp('🛑 Manual stop requested');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      logWithTimestamp(`Cannot stop - MediaRecorder state: ${mediaRecorderRef.current?.state || 'null'}`);
      cleanup();
    }
  }, [logWithTimestamp]);

  const cleanup = useCallback(() => {
    logWithTimestamp('🧹 Cleaning up resources...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        logWithTimestamp(`🔌 Stopped track: ${track.label}`);
      });
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimeRef.current = null;
  }, [logWithTimestamp]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    formatTime,
    cleanup
  };
};