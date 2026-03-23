import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  BackwardIcon
} from '@heroicons/react/24/outline';
import { TranscriptionSegment } from '../../types';

interface AudioPlayerProps {
  audioUrl: string;
  segments?: TranscriptionSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentClick?: (segment: TranscriptionSegment) => void;
  className?: string;
  durationSeconds?: number;  // Duration from database (in seconds)
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  segments = [],
  onTimeUpdate,
  onSegmentClick,
  className = '',
  durationSeconds,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);  // Start as not loading since we have duration
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);  // Use database duration immediately
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedAudio, setHasLoadedAudio] = useState(false);  // Track if audio has been loaded

  // On-demand audio loading - only set up events when audio is needed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || !hasLoadedAudio) return;

    const handleLoadedMetadata = () => {
      // Only update duration if we don't have it from database
      if (!durationSeconds && audio.duration) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      const current = audio.currentTime || 0;
      setCurrentTime(current);
      onTimeUpdate?.(current);

      // Find active segment based on current time
      const currentSegmentIndex = segments.findIndex(
        segment => current >= segment.start_time && current <= segment.end_time
      );
      setActiveSegmentIndex(currentSegmentIndex >= 0 ? currentSegmentIndex : null);
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
      setError('Failed to load audio');
      setIsLoading(false);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    // Add event listeners only after audio loading starts
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
  }, [audioUrl, onTimeUpdate, segments, hasLoadedAudio, durationSeconds]);

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
    } catch (err) {
      setError('Playback failed');
      setIsLoading(false);
      console.error('Audio playback error:', err);
    }
  };

  const handleProgressClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    // Load audio if not loaded yet (for seeking)
    if (!hasLoadedAudio) {
      setIsLoading(true);
      setHasLoadedAudio(true);
      // Wait briefly for audio to load
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
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

  const skipForward = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Load audio if not loaded yet
    if (!hasLoadedAudio) {
      setIsLoading(true);
      setHasLoadedAudio(true);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const newTime = Math.min(currentTime + 10, duration);
    audio.currentTime = newTime;
  };

  const skipBackward = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Load audio if not loaded yet
    if (!hasLoadedAudio) {
      setIsLoading(true);
      setHasLoadedAudio(true);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const newTime = Math.max(currentTime - 10, 0);
    audio.currentTime = newTime;
  };

  const handleSegmentClick = async (segment: TranscriptionSegment) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Load audio if not loaded yet
    if (!hasLoadedAudio) {
      setIsLoading(true);
      setHasLoadedAudio(true);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    audio.currentTime = segment.start_time;
    onSegmentClick?.(segment);
  };

  const getSegmentPosition = (segment: TranscriptionSegment) => {
    if (duration === 0) return { left: 0, width: 0 };

    const startPercent = (segment.start_time / duration) * 100;
    const widthPercent = (segment.duration / duration) * 100;

    return {
      left: `${startPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-surface-container-lowest rounded-lg p-4 ${className}`}>
      {/* Simple HTML5 Audio with format fallbacks - browser handles all streaming */}
      <audio
        ref={audioRef}
        preload="none" // Optimize bandwidth - load nothing until user plays (best for large files)
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      >
        {/* Primary: WebM with Opus codec - best compression for large files (40% smaller) */}
        <source src={audioUrl} type="audio/webm; codecs=opus" />
        {/* Fallback: MP4/AAC for iOS/Safari compatibility */}
        <source src={audioUrl.replace('.webm', '.m4a')} type="audio/mp4; codecs=aac" />
        {/* Fallback: MP3 for universal compatibility */}
        <source src={audioUrl.replace('.webm', '.mp3')} type="audio/mpeg" />
        {/* Final fallback: original URL without specific codec */}
        <source src={audioUrl} />
        Your browser does not support the audio element.
      </audio>

      {/* Main Controls */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={skipBackward}
          className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary transition-colors"
          title="Rewind 10 seconds"
          disabled={isLoading}
        >
          <BackwardIcon className="h-5 w-5" />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={`p-3 rounded-full transition-colors ${
            isLoading
              ? 'bg-surface-container cursor-not-allowed text-on-surface-variant'
              : 'bg-gradient-to-br from-primary to-primary-container hover:opacity-90 text-surface'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="h-6 w-6" />
          )}
        </button>

        <button
          onClick={skipForward}
          className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary transition-colors"
          title="Forward 10 seconds"
          disabled={isLoading}
        >
          <ForwardIcon className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={toggleMute}
            className="p-1 rounded hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface"
          >
            {isMuted ? (
              <SpeakerXMarkIcon className="h-5 w-5" />
            ) : (
              <SpeakerWaveIcon className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-surface-container rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex-1" />

        <div className="text-sm text-on-surface-variant font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Progress Bar with Segments */}
      <div className="relative">
        <div
          className="w-full h-1.5 bg-surface-container rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleProgressClick}
        >
          {/* Segment markers */}
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className={`absolute top-0 bottom-0 rounded cursor-pointer transition-colors ${
                index === activeSegmentIndex
                  ? 'bg-primary z-20'
                  : 'bg-surface-container-highest hover:bg-outline z-10'
              }`}
              style={getSegmentPosition(segment)}
              onClick={(e) => {
                e.stopPropagation();
                handleSegmentClick(segment);
              }}
              title={`${segment.text.substring(0, 50)}...`}
            />
          ))}

          {/* Progress indicator */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-container rounded-full z-30 transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Time markers */}
        {segments.length > 0 && (
          <div className="flex justify-between text-xs text-on-surface-variant uppercase tracking-wider mt-1">
            <span>0:00</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-error-container/20 rounded-lg">
          <div className="flex items-center space-x-2 text-error">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-sm">Audio Playback Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-3 p-3 bg-surface-container rounded-lg">
          <div className="flex items-center space-x-2 text-on-surface-variant">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm">Loading audio...</p>
          </div>
        </div>
      )}

      {/* Current Segment Info */}
      {activeSegmentIndex !== null && segments[activeSegmentIndex] && (
        <div className="mt-3 p-3 bg-surface-container-high rounded-lg">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider mb-1">
            <span>Current segment</span>
            <span>
              {formatTime(segments[activeSegmentIndex].start_time)} -{' '}
              {formatTime(segments[activeSegmentIndex].end_time)}
            </span>
          </div>
          <p className="text-on-surface font-sans text-sm leading-relaxed">
            {segments[activeSegmentIndex].text}
          </p>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
