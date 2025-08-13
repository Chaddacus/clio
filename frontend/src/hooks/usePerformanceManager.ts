import { useState, useEffect, useCallback, useRef } from 'react';
import { PerformanceManager, DeviceCapability, PerformanceMetrics, QualitySettings } from '../utils/PerformanceManager';

export interface UsePerformanceManagerOptions {
  autoStart?: boolean;
  onQualityChange?: (settings: QualitySettings) => void;
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
}

export const usePerformanceManager = (options: UsePerformanceManagerOptions = {}) => {
  const { autoStart = true, onQualityChange, onPerformanceChange } = options;
  
  const performanceManagerRef = useRef<PerformanceManager | null>(null);
  const [deviceCapability, setDeviceCapability] = useState<DeviceCapability | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [qualitySettings, setQualitySettings] = useState<QualitySettings | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceStatus, setPerformanceStatus] = useState<'good' | 'moderate' | 'poor'>('good');

  // Initialize performance manager
  useEffect(() => {
    if (!performanceManagerRef.current) {
      performanceManagerRef.current = new PerformanceManager();
    }

    const manager = performanceManagerRef.current;

    // Set up initial state
    const updateInitialState = () => {
      setDeviceCapability(manager.getDeviceCapability());
      setCurrentMetrics(manager.getCurrentMetrics());
      setQualitySettings(manager.getCurrentQualitySettings());
    };

    // Update initial state after a short delay to allow detection to complete
    const timeout = setTimeout(updateInitialState, 1000);

    // Set up callbacks
    const unsubscribePerformance = manager.onPerformanceChange((metrics) => {
      setCurrentMetrics(metrics);
      onPerformanceChange?.(metrics);
      
      // Update performance status
      if (metrics.fps < 20 || metrics.cpuLoad > 80 || metrics.memoryPressure) {
        setPerformanceStatus('poor');
      } else if (metrics.fps < 40 || metrics.cpuLoad > 60) {
        setPerformanceStatus('moderate');
      } else {
        setPerformanceStatus('good');
      }
    });

    const unsubscribeQuality = manager.onQualityChange((settings) => {
      setQualitySettings(settings);
      onQualityChange?.(settings);
    });

    // Auto-start monitoring if requested
    if (autoStart) {
      manager.startMonitoring();
      setIsMonitoring(true);
    }

    // Cleanup
    return () => {
      clearTimeout(timeout);
      unsubscribePerformance();
      unsubscribeQuality();
      if (performanceManagerRef.current) {
        performanceManagerRef.current.stopMonitoring();
      }
    };
  }, [autoStart, onPerformanceChange, onQualityChange]);

  const startMonitoring = useCallback(() => {
    if (performanceManagerRef.current && !isMonitoring) {
      performanceManagerRef.current.startMonitoring();
      setIsMonitoring(true);
    }
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (performanceManagerRef.current && isMonitoring) {
      performanceManagerRef.current.stopMonitoring();
      setIsMonitoring(false);
    }
  }, [isMonitoring]);

  const forceQualityTier = useCallback((tier: DeviceCapability['tier']) => {
    if (performanceManagerRef.current) {
      performanceManagerRef.current.forceQualityTier(tier);
    }
  }, []);

  const updateAudioLatency = useCallback((latency: number) => {
    if (performanceManagerRef.current) {
      performanceManagerRef.current.updateAudioLatency(latency);
    }
  }, []);

  const getPerformanceInfo = useCallback(() => {
    if (!deviceCapability || !currentMetrics || !qualitySettings) {
      return null;
    }

    return {
      deviceInfo: {
        tier: deviceCapability.tier,
        cpuCores: deviceCapability.cpuCores,
        memoryGB: deviceCapability.memoryGB,
        performanceScore: deviceCapability.performanceScore
      },
      currentPerformance: {
        fps: currentMetrics.fps,
        cpuLoad: currentMetrics.cpuLoad,
        memoryPressure: currentMetrics.memoryPressure,
        audioLatency: currentMetrics.audioLatency
      },
      audioSettings: {
        sampleRate: qualitySettings.sampleRate,
        bitrate: qualitySettings.bitrate,
        codec: qualitySettings.codec
      },
      enabledFeatures: {
        visualization: qualitySettings.enableVisualization,
        speechRecognition: qualitySettings.enableSpeechRecognition,
        debugLogging: qualitySettings.enableDebugLogging
      }
    };
  }, [deviceCapability, currentMetrics, qualitySettings]);

  const getQualityDescription = useCallback(() => {
    if (!qualitySettings) return 'Unknown';
    
    if (qualitySettings.sampleRate >= 44100 && qualitySettings.enableVisualization && qualitySettings.enableSpeechRecognition) {
      return 'High Quality';
    } else if (qualitySettings.sampleRate >= 22050 && qualitySettings.enableVisualization) {
      return 'Medium Quality';
    } else if (qualitySettings.enableVisualization) {
      return 'Basic Quality';
    } else {
      return 'Audio Only';
    }
  }, [qualitySettings]);

  const getPerformanceStatusColor = useCallback(() => {
    switch (performanceStatus) {
      case 'good':
        return 'text-green-600';
      case 'moderate':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
    }
  }, [performanceStatus]);

  const getPerformanceStatusText = useCallback(() => {
    switch (performanceStatus) {
      case 'good':
        return 'Excellent Performance';
      case 'moderate':
        return 'Good Performance';
      case 'poor':
        return 'Performance Issues Detected';
    }
  }, [performanceStatus]);

  const shouldEnableFeature = useCallback((feature: keyof QualitySettings) => {
    if (!qualitySettings) return false;
    return qualitySettings[feature] as boolean;
  }, [qualitySettings]);

  const getRecommendedSettings = useCallback(() => {
    if (!deviceCapability) return null;

    const recommendations = [];

    if (deviceCapability.tier === 'emergency') {
      recommendations.push('Consider closing other browser tabs to improve performance');
      recommendations.push('Try using a different browser if issues persist');
    } else if (deviceCapability.tier === 'low') {
      recommendations.push('Audio quality has been optimized for your device');
      recommendations.push('For better quality, close unnecessary applications');
    } else if (deviceCapability.tier === 'medium') {
      recommendations.push('Good audio quality is available');
      recommendations.push('All core features are enabled');
    } else {
      recommendations.push('Maximum quality settings are available');
      recommendations.push('All advanced features are enabled');
    }

    return recommendations;
  }, [deviceCapability]);

  return {
    // State
    deviceCapability,
    currentMetrics,
    qualitySettings,
    isMonitoring,
    performanceStatus,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    forceQualityTier,
    updateAudioLatency,
    
    // Computed values
    getPerformanceInfo,
    getQualityDescription,
    getPerformanceStatusColor,
    getPerformanceStatusText,
    shouldEnableFeature,
    getRecommendedSettings,
    
    // Manager instance (for advanced usage)
    performanceManager: performanceManagerRef.current
  };
};

export default usePerformanceManager;