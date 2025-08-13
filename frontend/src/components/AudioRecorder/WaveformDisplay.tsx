import React, { useEffect, useRef } from 'react';
import { usePerformanceManager } from '../../hooks/usePerformanceManager';

interface WaveformDisplayProps {
  audioLevel: number;
  isRecording: boolean;
  isPaused: boolean;
  height?: number;
  barCount?: number;
  className?: string;
  enablePerformanceOptimizations?: boolean;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioLevel,
  isRecording,
  isPaused,
  height = 60,
  barCount = 40,
  className = '',
  enablePerformanceOptimizations = true,
}) => {
  const performanceManager = usePerformanceManager({ autoStart: enablePerformanceOptimizations });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));
  const lastUpdateTime = useRef<number>(0);
  const frameSkipCounter = useRef<number>(0);
  
  // Get performance-aware settings
  const shouldEnableOptimizations = enablePerformanceOptimizations && performanceManager.qualitySettings;
  const targetFPS = shouldEnableOptimizations ? performanceManager.qualitySettings?.animationFPS || 30 : 60;
  const frameInterval = 1000 / targetFPS;
  const performanceStatus = performanceManager.performanceStatus || 'good';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const now = performance.now();
      
      // Performance-aware frame skipping
      if (shouldEnableOptimizations && (now - lastUpdateTime.current) < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      
      // Additional frame skipping for poor performance
      if (performanceStatus === 'poor') {
        frameSkipCounter.current++;
        if (frameSkipCounter.current % 2 !== 0) {
          animationFrameRef.current = requestAnimationFrame(draw);
          return;
        }
      }
      
      lastUpdateTime.current = now;
      
      const { width, height: canvasHeight } = canvas;
      
      // Performance optimization: Use requestIdleCallback for non-critical updates
      const isHighPerformance = !shouldEnableOptimizations || performanceStatus === 'good';
      
      // Clear canvas
      ctx.fillStyle = '#1f2937'; // gray-800
      ctx.fillRect(0, 0, width, canvasHeight);

      const barWidth = width / barCount;
      const barSpacing = barWidth * 0.1;
      const actualBarWidth = barWidth - barSpacing;

      // Update bars based on audio level
      if (isRecording && !isPaused) {
        // Shift existing bars to the left
        for (let i = 0; i < barCount - 1; i++) {
          barsRef.current[i] = barsRef.current[i + 1];
        }
        
        // Add new bar based on current audio level
        // Always show some activity when recording, even if audio level is low
        const baseLevel = Math.max(0.05, audioLevel * 0.9);
        const randomVariation = isHighPerformance ? Math.random() * 0.1 : 0.05; // Reduced randomness for low performance
        const newBarHeight = Math.min(1.0, baseLevel + randomVariation);
        barsRef.current[barCount - 1] = newBarHeight;
        
        // Performance-aware debug logging
        if (shouldEnableOptimizations && 
            performanceManager.qualitySettings?.enableDebugLogging && 
            Math.random() < 0.005) { // Reduced frequency
          console.log(`Waveform update: audioLevel=${(audioLevel * 100).toFixed(1)}%, barHeight=${(newBarHeight * 100).toFixed(1)}%, fps=${targetFPS}`);
        }
      } else if (!isRecording || isPaused) {
        // Gradually fade out bars when not recording
        for (let i = 0; i < barCount; i++) {
          barsRef.current[i] *= 0.95;
        }
      }

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const barHeight = barsRef.current[i] * canvasHeight * 0.8;
        const x = i * barWidth + barSpacing / 2;
        const y = (canvasHeight - barHeight) / 2;

        // Color gradient based on bar height and position
        const intensity = barsRef.current[i];
        let color;
        
        if (isPaused) {
          color = `rgba(251, 191, 36, ${intensity})`; // yellow
        } else if (isRecording) {
          if (intensity > 0.7) {
            color = `rgba(239, 68, 68, ${intensity})`; // red
          } else if (intensity > 0.4) {
            color = `rgba(251, 191, 36, ${intensity})`; // yellow
          } else {
            color = `rgba(34, 197, 94, ${intensity})`; // green
          }
        } else {
          color = `rgba(107, 114, 128, ${intensity})`; // gray
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, y, actualBarWidth, barHeight);

        // Add glow effect for active recording (only on high performance)
        if (isHighPerformance && isRecording && !isPaused && intensity > 0.5) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fillRect(x, y, actualBarWidth, barHeight);
          ctx.shadowBlur = 0;
        }
      }

      if (isRecording || barsRef.current.some(bar => bar > 0.01)) {
        animationFrameRef.current = requestAnimationFrame(draw);
      } else if (shouldEnableOptimizations) {
        // Clean up animation frame when not needed to save resources
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    };

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Start animation
    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioLevel, isRecording, isPaused, height, barCount, shouldEnableOptimizations, targetFPS, performanceStatus, performanceManager]);

  return (
    <div className={`relative ${className}`} data-testid="waveform-display">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg bg-gray-800"
        style={{ height: `${height}px` }}
        data-testid="waveform-canvas"
      />
      
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-2 right-2">
          <div className={`w-3 h-3 rounded-full ${
            isPaused 
              ? 'bg-yellow-500 animate-pulse' 
              : 'bg-red-500 animate-pulse-fast'
          }`} />
        </div>
      )}
      
      {/* Center line */}
      <div 
        className="absolute left-0 right-0 border-t border-gray-600 opacity-30" 
        style={{ top: `${height / 2}px` }}
      />
    </div>
  );
};

export default WaveformDisplay;