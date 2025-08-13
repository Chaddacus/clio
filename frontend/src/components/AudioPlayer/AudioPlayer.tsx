import React, { useState, useRef, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';

interface AudioPlayerProps {
  audioUrl?: string;
  audioBlob?: Blob;
  title?: string;
  className?: string;
  compact?: boolean;
  onLoadError?: (error: Error) => void;
  durationSeconds?: number;  // Duration from database (in seconds)
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioBlob,
  title = 'Audio Recording',
  className = '',
  compact = false,
  onLoadError,
  durationSeconds
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);  // Start as not loading since we have duration
  const [duration, setDuration] = useState(durationSeconds || 0);  // Use database duration immediately
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [hasLoadedAudio, setHasLoadedAudio] = useState(false);  // Track if audio has been loaded

  // Create audio URL from blob or use provided URL (but don't load audio yet)
  useEffect(() => {
    setLoadError(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setHasLoadedAudio(false); // Reset loading state
    
    if (audioBlob) {
      const blobUrl = URL.createObjectURL(audioBlob);
      setAudioSrc(blobUrl);
      
      return () => {
        URL.revokeObjectURL(blobUrl);
      };
    } else if (audioUrl) {
      setAudioSrc(audioUrl);
    } else {
      setAudioSrc(null);
    }
  }, [audioBlob, audioUrl]);

  // On-demand audio loading - only set up events when audio is needed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc || !hasLoadedAudio) return;

    const handleLoadedMetadata = () => {
      // Only update duration if we don't have it from database
      if (!durationSeconds && audio.duration) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      const errorMessage = 'Failed to load audio';
      setLoadError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      onLoadError?.(new Error(errorMessage));
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      // Cleanup
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [audioSrc, onLoadError, hasLoadedAudio, durationSeconds]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        // Load audio on first play if not already loaded
        if (!hasLoadedAudio) {
          setIsLoading(true);
          setHasLoadedAudio(true);
          // Audio element will load automatically due to useEffect dependency change
          
          // Wait briefly for initial loading before trying to play
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await audio.play();
      }
    } catch (error) {
      const errorMessage = 'Playback failed';
      setLoadError(errorMessage);
      setIsPlaying(false);
      setIsLoading(false);
      onLoadError?.(new Error(errorMessage));
    }
  };

  const handleSeek = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Load audio if not loaded yet (for seeking)
    if (!hasLoadedAudio) {
      setIsLoading(true);
      setHasLoadedAudio(true);
      // Wait briefly for audio to load
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const newTime = (parseFloat(event.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(event.target.value) / 100;
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioSrc) {
    return (
      <div className={`flex items-center justify-center p-4 text-gray-500 ${className}`}>
        <span className="text-sm">No audio available</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-center space-x-2 text-red-500">
          <span className="text-sm">{loadError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-3 ${className}`}>
      {/* Simple HTML5 Audio with format fallbacks - browser handles all streaming */}
      <audio 
        ref={audioRef} 
        preload="none" // Optimize bandwidth - load nothing until user plays (best for large files)
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      >
        {audioSrc && (
          <>
            {/* Primary: WebM with Opus codec - best compression for large files (40% smaller) */}
            {audioSrc.includes('.webm') && (
              <>
                <source src={audioSrc} type="audio/webm; codecs=opus" />
                <source src={audioSrc.replace('.webm', '.m4a')} type="audio/mp4; codecs=aac" />
                <source src={audioSrc.replace('.webm', '.mp3')} type="audio/mpeg" />
              </>
            )}
            {/* For non-WebM sources (blobs, MP3s) */}
            {!audioSrc.includes('.webm') && (
              <source src={audioSrc} type={audioSrc.includes('.mp3') ? 'audio/mpeg' : 'audio/mp4'} />
            )}
            <source src={audioSrc} />
          </>
        )}
        Your browser does not support the audio element.
      </audio>
      
      {!compact && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">
          {title}
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isLoading 
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed' 
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
          data-testid="audio-play-pause"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4 ml-0.5" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progressPercentage}
            onChange={handleSeek}
            disabled={!duration || isLoading}
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            data-testid="audio-progress"
          />
        </div>

        {/* Time Display */}
        <div className="flex-shrink-0 text-xs text-gray-600 dark:text-gray-400 font-mono min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {!compact && (
          <>
            {/* Volume Controls */}
            <button
              onClick={handleMuteToggle}
              className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              data-testid="audio-mute"
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="h-4 w-4" />
              ) : (
                <SpeakerWaveIcon className="h-4 w-4" />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume * 100}
              onChange={handleVolumeChange}
              className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              data-testid="audio-volume"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;