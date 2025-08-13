import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorderState, AudioVisualizationData } from '../types';
// import { usePerformanceManager } from './usePerformanceManager';
// import { QualitySettings } from '../utils/PerformanceManager';

export interface UseAudioRecorderOptions {
  mimeType?: string;
  sampleRate?: number;
  onDataAvailable?: (data: Blob) => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
  onError?: (error: Error) => void;
  enablePerformanceManagement?: boolean;
}

export const useAudioRecorder = (options: UseAudioRecorderOptions = {}) => {
  const {
    mimeType = 'audio/webm',
    sampleRate = 44100,
    onDataAvailable,
    onRecordingComplete,
    onError,
    enablePerformanceManagement = true
  } = options;

  // Performance management DISABLED - was causing MediaRecorder interference
  // const performanceManager = usePerformanceManager({
  //   autoStart: false, // 🔧 CRITICAL FIX: Disable autoStart to prevent interference
  //   onQualityChange: (settings) => {
  //     if (enablePerformanceManagement) {
  //       updateRecordingSettings(settings);
  //     }
  //   }
  // });

  // const [currentQualitySettings, setCurrentQualitySettings] = useState<QualitySettings | null>(null);

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioLevel: 0,
    mediaRecorder: null,
    stream: null,
  });

  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioLevelUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioLevelUpdate = useRef<number>(0);
  
  // Audio quality settings - using defaults since Performance Manager is disabled
  const getEffectiveSampleRate = useCallback(() => {
    return sampleRate;  // Use provided sampleRate directly
  }, [sampleRate]);
  
  const getEffectiveMimeType = useCallback(() => {
    return mimeType;    // Use provided mimeType directly
  }, [mimeType]);
  
  const shouldEnableVisualization = useCallback(() => {
    return true;        // Always enable visualization
  }, []);
  
  const getAudioAnalysisInterval = useCallback(() => {
    return 16;          // 60fps default
  }, []);
  
  const shouldEnableDebugLogging = useCallback(() => {
    return true;        // Always enable debug logging
  }, []);

  // Performance-based recording settings DISABLED
  // const updateRecordingSettings = useCallback((settings: QualitySettings) => {
  //   setCurrentQualitySettings(settings);
  //   
  //   if (shouldEnableDebugLogging()) {
  //     // console.log('[useAudioRecorder] Quality settings updated:', settings); // DISABLED for debugging
  //   }
  // }, [shouldEnableDebugLogging]);
  
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.permissions) {
        // Permissions API not supported, assume we need to try getUserMedia
        return false;
      }
      
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permissionStatus.state === 'granted';
    } catch (error) {
      // Permission query failed, assume we need to request permission
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    console.log('[useAudioRecorder] startRecording called');
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media recording not supported in this browser');
      }
      console.log('[useAudioRecorder] MediaDevices check passed');

      // Performance Manager coordination DISABLED - no longer interfering
      // if (enablePerformanceManagement && performanceManager.isMonitoring) {
      //   console.log('[useAudioRecorder] 🔧 COORDINATION: Pausing performance monitoring during recording startup');
      //   performanceManager.stopMonitoring();
      // }

      // Request microphone permission with user-friendly error handling
      const effectiveSampleRate = getEffectiveSampleRate();
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: effectiveSampleRate,
          // Advanced constraints for better audio quality
          channelCount: 1, // Mono for voice recordings
          ...(effectiveSampleRate >= 44100 && {
            latency: 0.01, // Low latency for high quality
          }),
        }
      };

      console.log('[useAudioRecorder] Calling getUserMedia with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[useAudioRecorder] getUserMedia returned:', {
        streamType: typeof stream,
        streamConstructor: stream?.constructor?.name,
        streamId: (stream as any)?.id,
        isMediaStream: stream instanceof MediaStream
      });
      
      // Validate stream before proceeding
      if (!stream) {
        console.error('[useAudioRecorder] getUserMedia returned null or undefined stream');
        throw new Error('getUserMedia returned null or undefined stream');
      }
      
      if (!(stream instanceof MediaStream)) {
        console.error('[useAudioRecorder] Invalid stream object:', {
          streamType: typeof stream,
          streamConstructor: (stream as any).constructor?.name,
          hasGetTracks: typeof (stream as any).getTracks,
          hasGetAudioTracks: typeof (stream as any).getAudioTracks,
          stream: stream as any
        });
        throw new Error(`getUserMedia returned invalid stream type: ${typeof stream}`);
      }
      
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) {
        throw new Error('No audio tracks found in media stream');
      }
      
      console.log('[useAudioRecorder] Stream validation passed:', {
        streamId: stream.id,
        trackCount: tracks.length,
        firstTrackLabel: tracks[0].label,
        firstTrackState: tracks[0].readyState
      });
      
      // Add detailed track validation and monitoring
      tracks.forEach((track, index) => {
        console.log(`[useAudioRecorder] Audio Track ${index} details:`, {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label,
          muted: track.muted
        });
        
        // Monitor track ended events
        track.addEventListener('ended', () => {
          console.warn(`[useAudioRecorder] Audio track ${index} ended unexpectedly!`, {
            trackId: track.id,
            timestamp: Date.now()
          });
          console.warn('[useAudioRecorder] This may cause MediaRecorder to stop!');
        });
        
        // Monitor track mute events  
        track.addEventListener('mute', () => {
          console.warn(`[useAudioRecorder] Audio track ${index} muted!`, {
            trackId: track.id,
            timestamp: Date.now()
          });
        });
        
        track.addEventListener('unmute', () => {
          console.log(`[useAudioRecorder] Audio track ${index} unmuted`, {
            trackId: track.id,
            timestamp: Date.now()
          });
        });
      });
      
      const effectiveMimeType = getEffectiveMimeType();
      
      // Try different MediaRecorder configurations in order of preference
      const fallbackConfigs = [
        // First try: Preferred configuration
        {
          mimeType: MediaRecorder.isTypeSupported(effectiveMimeType) ? effectiveMimeType : 'audio/webm;codecs=opus',
          audioBitsPerSecond: undefined // Use default bitrate since Performance Manager disabled
        },
        // Second try: Basic webm with opus
        {
          mimeType: 'audio/webm;codecs=opus'
        },
        // Third try: Basic webm
        {
          mimeType: 'audio/webm'
        },
        // Fourth try: MP4 if supported
        {
          mimeType: MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
        },
        // Last try: No specified mime type (let browser choose)
        {}
      ];
      
      let mediaRecorderOptions: MediaRecorderOptions = {};
      let configIndex = 0;
      
      // Find the first supported configuration
      for (const config of fallbackConfigs) {
        if (!config.mimeType || MediaRecorder.isTypeSupported(config.mimeType)) {
          mediaRecorderOptions = { ...config };
          console.log(`[useAudioRecorder] Using config ${configIndex}:`, config);
          break;
        }
        configIndex++;
      }
      
      console.log('[useAudioRecorder] Creating MediaRecorder with stream:', {
        streamType: stream.constructor.name,
        streamId: stream.id,
        options: mediaRecorderOptions
      });
      
      let mediaRecorder!: MediaRecorder;
      let creationSuccess = false;
      let lastError: any = null;
      
      // Try each configuration until one works
      for (let attempt = 0; attempt < fallbackConfigs.length && !creationSuccess; attempt++) {
        const config = fallbackConfigs[attempt];
        
        // Skip unsupported mime types
        if (config.mimeType && !MediaRecorder.isTypeSupported(config.mimeType)) {
          console.log(`[useAudioRecorder] Skipping unsupported config ${attempt}:`, config);
          continue;
        }
        
        try {
          console.log(`[useAudioRecorder] Attempt ${attempt + 1}: Calling MediaRecorder constructor with:`, {
            streamInfo: {
              id: stream.id,
              active: stream.active,
              getTracks: stream.getTracks().length,
              getAudioTracks: stream.getAudioTracks().length,
              constructor: stream.constructor.name
            },
            config,
            isTypeSupported: !config.mimeType || MediaRecorder.isTypeSupported(config.mimeType)
          });
          
          mediaRecorder = new MediaRecorder(stream, config);
          creationSuccess = true;
          
          console.log(`[useAudioRecorder] MediaRecorder constructor succeeded on attempt ${attempt + 1}:`, {
            state: mediaRecorder.state,
            mimeType: mediaRecorder.mimeType,
            videoBitsPerSecond: mediaRecorder.videoBitsPerSecond,
            audioBitsPerSecond: mediaRecorder.audioBitsPerSecond
          });
          
        } catch (mediaRecorderError) {
          lastError = mediaRecorderError;
          console.warn(`[useAudioRecorder] MediaRecorder attempt ${attempt + 1} failed:`, {
            error: mediaRecorderError,
            errorName: (mediaRecorderError as any)?.name,
            errorMessage: (mediaRecorderError as any)?.message,
            config
          });
        }
      }
      
      if (!creationSuccess) {
        console.error('[useAudioRecorder] All MediaRecorder creation attempts failed:', {
          lastError,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          audioTrackCount: stream.getAudioTracks().length,
          triedConfigs: fallbackConfigs.length
        });
        const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown MediaRecorder error';
        throw new Error(`MediaRecorder creation failed after ${fallbackConfigs.length} attempts: ${errorMessage}`);
      }

      chunksRef.current = [];
      console.log('[useAudioRecorder] Chunks array initialized');
      
      // Track recording timing
      const recordingStartTime = Date.now();
      console.log('[useAudioRecorder] Recording start time:', recordingStartTime);

      // Add comprehensive MediaRecorder event logging
      mediaRecorder.onstart = (event) => {
        const startDelay = Date.now() - recordingStartTime;
        console.log('[useAudioRecorder] MediaRecorder ONSTART event fired:', {
          state: mediaRecorder.state,
          timestamp: Date.now(),
          startDelay,
          event
        });
      };

      mediaRecorder.ondataavailable = (event) => {
        console.log('[useAudioRecorder] ondataavailable triggered:', {
          dataSize: event.data.size,
          dataType: event.data.type,
          recordingState: mediaRecorder.state,
          totalChunksSoFar: chunksRef.current.length
        });
        
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          onDataAvailable?.(event.data);
          
          console.log('[useAudioRecorder] Data chunk accepted:', {
            size: event.data.size,
            type: event.data.type,
            totalChunks: chunksRef.current.length,
            totalSize: chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
          });
        } else {
          console.warn('[useAudioRecorder] Received empty data chunk, ignoring');
        }
      };

      mediaRecorder.onstop = () => {
        const stopTime = Date.now();
        const recordingDuration = stopTime - recordingStartTime;
        console.log('[useAudioRecorder] MediaRecorder ONSTOP event fired:', {
          state: mediaRecorder.state,
          timestamp: stopTime,
          recordingDuration,
          totalChunks: chunksRef.current.length,
          chunkSizes: chunksRef.current.map(chunk => chunk.size),
          totalSize: chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        });
        
        const effectiveMimeType = getEffectiveMimeType();
        const actualMimeType = MediaRecorder.isTypeSupported(effectiveMimeType) ? effectiveMimeType : 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: actualMimeType });
        
        // Comprehensive logging for blob creation
        console.log('[useAudioRecorder] Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: chunksRef.current.length,
          mimeType: actualMimeType,
          effectiveMimeType,
          chunkDetails: chunksRef.current.map((chunk, i) => ({
            index: i,
            size: chunk.size,
            type: chunk.type
          }))
        });
        
        // Enhanced validation
        if (audioBlob.size === 0) {
          console.error('[useAudioRecorder] Created empty audio blob!', {
            chunksAvailable: chunksRef.current.length,
            recordingDuration: state.recordingTime
          });
          onError?.(new Error('Recording failed: Empty audio data'));
          return;
        }
        
        if (audioBlob.size < 1000) { // Less than 1KB is suspicious
          console.warn('[useAudioRecorder] Audio blob is very small, possible recording issue:', {
            size: audioBlob.size,
            chunks: chunksRef.current.length,
            recordingTime: state.recordingTime
          });
        }
        
        // Performance Manager resume DISABLED - no longer interfering
        // if (enablePerformanceManagement) {
        //   console.log('[useAudioRecorder] 🔧 COORDINATION: Resuming performance monitoring after recording completion');
        //   performanceManager.startMonitoring();
        // }
        
        onRecordingComplete?.(audioBlob);
        chunksRef.current = [];
      };

      mediaRecorder.onerror = (event) => {
        const errorTime = Date.now();
        const timeFromStart = errorTime - recordingStartTime;
        console.error('[useAudioRecorder] MediaRecorder ONERROR event fired:', {
          state: mediaRecorder.state,
          timestamp: errorTime,
          timeFromStart,
          error: (event as any).error,
          event
        });
        const error = new Error(`MediaRecorder error: ${(event as any).error || 'Unknown error'}`);
        onError?.(error);
      };
      
      mediaRecorder.onpause = (event) => {
        console.log('[useAudioRecorder] MediaRecorder ONPAUSE event fired:', {
          state: mediaRecorder.state,
          timestamp: Date.now()
        });
      };
      
      mediaRecorder.onresume = (event) => {
        console.log('[useAudioRecorder] MediaRecorder ONRESUME event fired:', {
          state: mediaRecorder.state,
          timestamp: Date.now()
        });
      };

      // Set up audio analysis if visualization is enabled
      console.log('[useAudioRecorder] Checking if visualization should be enabled...');
      if (shouldEnableVisualization()) {
        console.log('[useAudioRecorder] Visualization enabled, creating AudioContext...');
        audioContextRef.current = new AudioContext();
        
        if (shouldEnableDebugLogging()) {
          console.log('AudioContext created, state:', audioContextRef.current.state);
        }
      } else {
        console.log('[useAudioRecorder] Visualization disabled for performance');
      }
      
      // Handle AudioContext suspended state (required by Chrome autoplay policy)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        if (shouldEnableDebugLogging()) {
          console.log('AudioContext resumed, new state:', audioContextRef.current.state);
        }
      }
      
      // IMPORTANT: Start MediaRecorder FIRST to avoid timing conflicts
      console.log('[useAudioRecorder] Starting MediaRecorder before AudioContext setup...');
      
      // Use smaller chunks to ensure data collection
      const timesliceMs = 250; // 250ms chunks for better data collection
      console.log('[useAudioRecorder] Starting MediaRecorder with options:', {
        timeslice: timesliceMs,
        mimeType: mediaRecorderOptions.mimeType,
        audioBitsPerSecond: mediaRecorderOptions.audioBitsPerSecond,
        state: mediaRecorder.state
      });
      
      // Log state before starting
      console.log('[useAudioRecorder] MediaRecorder state before start():', mediaRecorder.state);
      
      mediaRecorder.start(timesliceMs);
      
      // Log state immediately after starting
      console.log('[useAudioRecorder] MediaRecorder state immediately after start():', mediaRecorder.state);
      
      // TIMING SAFEGUARD: Wait for MediaRecorder to properly start before setting up AudioContext
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      
      // Now set up AudioContext AFTER MediaRecorder has started
      if (audioContextRef.current) {
        try {
          console.log('[useAudioRecorder] MediaRecorder started, now setting up AudioContext visualization...');
          const source = audioContextRef.current.createMediaStreamSource(stream);
          analyzerRef.current = audioContextRef.current.createAnalyser();
          
          // Default analyzer settings (Performance Manager disabled)
          analyzerRef.current.fftSize = 256;
          analyzerRef.current.smoothingTimeConstant = 0.5;
          
          source.connect(analyzerRef.current);
          
          // Log audio setup completion
          if (shouldEnableDebugLogging()) {
            console.log('Audio visualization setup complete (after MediaRecorder start):', {
              fftSize: analyzerRef.current.fftSize,
              frequencyBinCount: analyzerRef.current.frequencyBinCount,
              sampleRate: audioContextRef.current.sampleRate,
              contextState: audioContextRef.current.state,
              performanceTier: 'medium',
              mediaRecorderState: mediaRecorder.state
            });
          }
        } catch (audioContextError) {
          console.warn('[useAudioRecorder] Audio visualization setup failed:', audioContextError);
          console.warn('[useAudioRecorder] Continuing without audio visualization');
          
          // Clean up failed AudioContext
          if (audioContextRef.current) {
            try {
              audioContextRef.current.close();
            } catch (closeError) {
              console.warn('[useAudioRecorder] Failed to close AudioContext:', closeError);
            }
            audioContextRef.current = null;
          }
          analyzerRef.current = null;
          
          // Continue without visualization - recording should still work
        }
      } else {
        console.log('[useAudioRecorder] No AudioContext created, skipping visualization setup');
      }
      
      // Check MediaRecorder state after AudioContext setup to ensure no interference
      console.log('[useAudioRecorder] MediaRecorder state after AudioContext setup:', mediaRecorder.state);
      
      // Check state after small delays to catch immediate transitions
      setTimeout(() => {
        console.log('[useAudioRecorder] MediaRecorder state after 10ms:', mediaRecorder.state);
      }, 10);
      
      setTimeout(() => {
        console.log('[useAudioRecorder] MediaRecorder state after 100ms:', mediaRecorder.state);
      }, 100);
      
      setTimeout(() => {
        console.log('[useAudioRecorder] MediaRecorder state after 500ms:', mediaRecorder.state);
      }, 500);

      // Clear any existing timer before starting
      if (timerRef.current) {
        console.log('[useAudioRecorder] Clearing existing timer before starting new one');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      console.log('[useAudioRecorder] Setting initial recording state');
      setState(prev => {
        const newState = {
          ...prev,
          isRecording: true,
          isPaused: false,
          mediaRecorder,
          stream,
          recordingTime: 0,
        };
        console.log('[useAudioRecorder] State transition:', { 
          before: { 
            isRecording: prev.isRecording, 
            recordingTime: prev.recordingTime 
          }, 
          after: { 
            isRecording: newState.isRecording, 
            recordingTime: newState.recordingTime 
          } 
        });
        return newState;
      });

      // Start timer with a small delay to ensure state has been set
      console.log('[useAudioRecorder] Starting timer interval');
      timerRef.current = setInterval(() => {
        setState(prev => {
          // Only increment if we're still recording and not paused
          if (!prev.isRecording || prev.isPaused) {
            console.log('[useAudioRecorder] Timer tick skipped - not recording or paused', {
              isRecording: prev.isRecording,
              isPaused: prev.isPaused
            });
            return prev;
          }
          
          const newTime = prev.recordingTime + 1;
          console.log('[useAudioRecorder] Timer tick - updating recordingTime from', prev.recordingTime, 'to', newTime);
          return {
            ...prev,
            recordingTime: newTime,
          };
        });
      }, 1000);

      // Start audio level monitoring if visualization is enabled and analyzer is available
      if (shouldEnableVisualization() && analyzerRef.current) {
        console.log('[useAudioRecorder] Starting audio level monitoring with proper timing coordination');
        // Add small delay to ensure MediaRecorder is fully started
        setTimeout(() => {
          updateAudioLevel();
        }, 200); // 200ms delay to ensure proper coordination
      } else {
        console.log('[useAudioRecorder] Audio level monitoring disabled or analyzer not available');
      }

      // Performance Manager coordination DISABLED - no longer needed

    } catch (error) {
      // Performance Manager error recovery DISABLED
      // if (enablePerformanceManagement) {
      //   console.log('[useAudioRecorder] 🔧 ERROR RECOVERY: Resuming performance monitoring due to recording error');
      //   performanceManager.startMonitoring();
      // }
      
      console.error('[useAudioRecorder] Full error details:', {
        error,
        errorName: (error as any)?.name,
        errorMessage: (error as any)?.message,
        errorStack: (error as any)?.stack,
        errorConstructor: (error as any)?.constructor?.name,
        typeof: typeof error,
        stringified: String(error)
      });
      
      let audioError: Error;
      
      if (error instanceof Error) {
        // Handle specific permission errors
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          audioError = new Error('Microphone permission denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          audioError = new Error('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          audioError = new Error('Microphone is being used by another application. Please close other apps and try again.');
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
          audioError = new Error('Your microphone doesn\'t support the required settings. Please try with a different microphone.');
        } else if (error.name === 'TypeError') {
          audioError = new Error('Audio recording is not supported in this browser. Please try a different browser.');
        } else if (error.name === 'NotSupportedError') {
          audioError = new Error('MediaRecorder is not supported in this browser or context. Please try a different browser.');
        } else {
          audioError = new Error(`Recording failed: ${error.name} - ${error.message}`);
        }
      } else {
        audioError = new Error(`Unknown error occurred while starting recording: ${String(error)}`);
      }
      
      onError?.(audioError);
    }
  }, [mimeType, sampleRate, onDataAvailable, onRecordingComplete, onError, 
      getEffectiveSampleRate, getEffectiveMimeType, shouldEnableVisualization, 
      shouldEnableDebugLogging]); // Removed performanceManager and currentQualitySettings

  const stopRecording = useCallback(() => {
    if (state.mediaRecorder && state.isRecording) {
      state.mediaRecorder.stop();
      
      // Stop all tracks to release microphone
      state.stream?.getTracks().forEach(track => track.stop());
      
      // Clean up audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
      
      if (timerRef.current) {
        console.log('[useAudioRecorder] Stopping recording - clearing timer interval');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (audioLevelUpdateRef.current) {
        clearTimeout(audioLevelUpdateRef.current);
        audioLevelUpdateRef.current = null;
      }

      // Performance Manager resume DISABLED - no longer interfering
      // if (enablePerformanceManagement) {
      //   console.log('[useAudioRecorder] 🔧 COORDINATION: Resuming performance monitoring after recording stop');
      //   performanceManager.startMonitoring();
      // }

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        mediaRecorder: null,
        stream: null,
        audioLevel: 0,
      }));
    }
  }, [state.mediaRecorder, state.isRecording, state.stream]);

  const pauseRecording = useCallback(() => {
    if (state.mediaRecorder && state.isRecording && !state.isPaused) {
      console.log('[useAudioRecorder] Pausing recording - clearing timer interval');
      state.mediaRecorder.pause();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log('[useAudioRecorder] Timer interval cleared for pause');
      }

      setState(prev => ({
        ...prev,
        isPaused: true,
      }));
    }
  }, [state.mediaRecorder, state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (state.mediaRecorder && state.isRecording && state.isPaused) {
      state.mediaRecorder.resume();
      
      // Restart timer
      console.log('[useAudioRecorder] Restarting timer interval after resume');
      timerRef.current = setInterval(() => {
        setState(prev => {
          // Only increment if we're still recording and not paused
          if (!prev.isRecording || prev.isPaused) {
            console.log('[useAudioRecorder] Timer tick skipped (resumed) - not recording or paused', {
              isRecording: prev.isRecording,
              isPaused: prev.isPaused
            });
            return prev;
          }
          
          const newTime = prev.recordingTime + 1;
          console.log('[useAudioRecorder] Timer tick (resumed) - updating recordingTime from', prev.recordingTime, 'to', newTime);
          return {
            ...prev,
            recordingTime: newTime,
          };
        });
      }, 1000);

      setState(prev => ({
        ...prev,
        isPaused: false,
      }));
    }
  }, [state.mediaRecorder, state.isRecording, state.isPaused]);

  const updateAudioLevel = useCallback(() => {
    if (!analyzerRef.current) {
      if (shouldEnableDebugLogging()) {
        console.log('No analyzer available');
      }
      return;
    }

    const now = performance.now();
    const analysisInterval = getAudioAnalysisInterval();
    
    // Throttle based on performance settings
    if (now - lastAudioLevelUpdate.current < analysisInterval) {
      // Schedule next update using appropriate method
      if (analysisInterval <= 20) {
        // High frequency updates use requestAnimationFrame
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      } else {
        // Low frequency updates use setTimeout
        audioLevelUpdateRef.current = setTimeout(updateAudioLevel, analysisInterval);
      }
      return;
    }
    
    lastAudioLevelUpdate.current = now;

    // Get current state values directly
    setState(prev => {
      if (!prev.isRecording || prev.isPaused) {
        // Stop updates if not recording
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (audioLevelUpdateRef.current) {
          clearTimeout(audioLevelUpdateRef.current);
          audioLevelUpdateRef.current = null;
        }
        return { ...prev, audioLevel: 0 };
      }

      // Get audio data
      const dataArray = new Uint8Array(analyzerRef.current!.frequencyBinCount);
      analyzerRef.current!.getByteFrequencyData(dataArray);
      
      // Calculate average audio level
      const sum = dataArray.reduce((acc, value) => acc + value, 0);
      const average = sum / dataArray.length;
      const normalizedLevel = average / 255;
      
      // Performance-aware debug logging
      if (shouldEnableDebugLogging() && normalizedLevel > 0.01 && Math.random() < 0.01) {
        console.log(`Audio level: ${(normalizedLevel * 100).toFixed(1)}%`, { 
          raw: average, 
          arrayLength: dataArray.length,
          nonZeroValues: dataArray.filter(v => v > 0).length,
          analysisInterval,
          fps: Math.round(1000 / analysisInterval)
        });
      }
      
      // Schedule next update based on performance
      if (analysisInterval <= 20) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      } else {
        audioLevelUpdateRef.current = setTimeout(updateAudioLevel, analysisInterval);
      }
      
      // Performance Manager audio latency update DISABLED
      // const audioLatency = performance.now() - now;
      // performanceManager.updateAudioLatency?.(audioLatency);
      
      return {
        ...prev,
        audioLevel: normalizedLevel,
      };
    });
  }, [shouldEnableDebugLogging, getAudioAnalysisInterval]); // Removed performanceManager

  const getVisualizationData = useCallback((): AudioVisualizationData | null => {
    if (!analyzerRef.current) return null;
    
    const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
    const timeData = new Uint8Array(analyzerRef.current.fftSize);
    
    analyzerRef.current.getByteFrequencyData(frequencyData);
    analyzerRef.current.getByteTimeDomainData(timeData);
    
    const averageFrequency = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    
    return {
      frequencyData,
      timeData,
      averageFrequency: averageFrequency / 255,
    };
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Check microphone permissions
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      // Fallback: try to access microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  // Performance Manager initialization DISABLED - no longer needed
  // useEffect(() => {
  //   if (enablePerformanceManagement && !state.isRecording) {
  //     console.log('[useAudioRecorder] 🔧 INITIALIZATION: Starting Performance Manager (not recording)');
  //     performanceManager.startMonitoring();
  //   }
  // }, [enablePerformanceManagement, performanceManager, state.isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up without calling stopRecording to avoid duplicate cleanup
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioLevelUpdateRef.current) {
        clearTimeout(audioLevelUpdateRef.current);
      }
      
      // Performance Manager cleanup DISABLED
      // performanceManager.stopMonitoring();
    };
  }, [state.stream]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getVisualizationData,
    formatTime,
    checkPermissions,
    checkMicrophonePermission,
    
    // Performance management DISABLED - providing simple defaults
    // performanceManager,
    // currentQualitySettings,
    shouldEnableVisualization: shouldEnableVisualization(),
    shouldEnableDebugLogging: shouldEnableDebugLogging(),
    getQualityDescription: () => 'Standard', // Static fallback since Performance Manager disabled
    getPerformanceStatus: (): 'good' | 'moderate' | 'poor' => 'good', // Static fallback since Performance Manager disabled
  };
};