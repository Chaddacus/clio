import React, { useRef, useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  BackwardIcon
} from '@heroicons/react/24/outline';

interface SimpleAudioPlayerProps {
  audioUrl: string;
  title?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  showControls?: boolean;
}

const SimpleAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({
  audioUrl,
  title,
  className = '',
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  showControls = true
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple event handlers - let browser handle everything
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      const current = audio.currentTime || 0;
      const dur = audio.duration || 0;
      setCurrentTime(current);
      onTimeUpdate?.(current, dur);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    // Add event listeners
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      // Cleanup
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTimeUpdate, onPlay, onPause, onEnded]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err) {
      setError('Playback failed');
      console.error('Audio playback error:', err);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSkipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = Math.min(currentTime + 10, duration);
    audio.currentTime = newTime;
  };

  const handleSkipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = Math.max(currentTime - 10, 0);
    audio.currentTime = newTime;
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

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 rounded-lg p-4 ${className}`}>
        <div className="text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 ${className}`}>
      {/* Native HTML5 Audio Element with format fallbacks - browser handles all streaming */}
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

      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 truncate">
          {title}
        </div>
      )}

      {showControls && (
        <>
          {/* Main Controls */}
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={handleSkipBackward}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              disabled={isLoading}
            >
              <BackwardIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              className={`p-3 rounded-full transition-colors ${
                isLoading 
                  ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed' 
                  : 'bg-primary-500 hover:bg-primary-600 text-white'
              }`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="h-6 w-6" />
              ) : (
                <PlayIcon className="h-6 w-6" />
              )}
            </button>

            <button
              onClick={handleSkipForward}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              disabled={isLoading}
            >
              <ForwardIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={toggleMute}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {isMuted ? (
                  <SpeakerXMarkIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <SpeakerWaveIcon className="h-5 w-5 text-gray-500" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex-1" />

            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              <div
                className="h-2 bg-primary-500 rounded-full transition-all duration-100"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </>
      )}

      {isLoading && (
        <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading audio...
        </div>
      )}
    </div>
  );
};

export default SimpleAudioPlayer;