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

  const startRecording = useCallback(async () => {
    try {
      startTimeRef.current = Date.now();

      setState(prev => ({ ...prev, error: null }));

      // Request microphone access with minimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder with default settings
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up minimal event handlers
      mediaRecorder.onstart = () => {
        setState(prev => ({ ...prev, isRecording: true, recordingTime: 0 }));

        // Start simple timer
        timerRef.current = setInterval(() => {
          setState(prev => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
        }, 1000);
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        const duration = (elapsed / 1000).toFixed(2);

        setState(prev => ({ ...prev, isRecording: false }));

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Create final blob
        new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

        // Analyze duration
        if (elapsed < 2000) {
          console.error(`[MinimalRecorder] PREMATURE STOP: Recording ended after only ${duration}s`);
          setState(prev => ({
            ...prev,
            error: `Recording stopped prematurely after ${duration}s`
          }));
        }

        // Cleanup
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        console.error(`[MinimalRecorder] MediaRecorder error at ${elapsed}ms:`, (event as any).error);

        setState(prev => ({
          ...prev,
          isRecording: false,
          error: `Recording error: ${(event as any).error}`
        }));

        cleanup();
      };

      // Start recording with basic configuration
      mediaRecorder.start(250); // 250ms timeslices

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MinimalRecorder] Recording setup failed: ${errorMessage}`);

      setState(prev => ({
        ...prev,
        isRecording: false,
        error: `Setup failed: ${errorMessage}`
      }));

      cleanup();
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanup();
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimeRef.current = null;
  }, []);

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
