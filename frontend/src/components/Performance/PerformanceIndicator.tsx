import React, { useState } from 'react';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  CpuChipIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { usePerformanceManager } from '../../hooks/usePerformanceManager';

interface PerformanceIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  className = '',
  showDetails = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const performanceManager = usePerformanceManager({ autoStart: true });
  
  const {
    deviceCapability,
    currentMetrics,
    qualitySettings,
    performanceStatus,
    getQualityDescription,
    getPerformanceStatusColor,
    getPerformanceStatusText,
    getRecommendedSettings
  } = performanceManager;

  if (!deviceCapability || !currentMetrics || !qualitySettings) {
    return null;
  }

  const getStatusIcon = () => {
    switch (performanceStatus) {
      case 'good':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'moderate':
        return <InformationCircleIcon className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
    }
  };

  const getDeviceTierDescription = (tier: string) => {
    switch (tier) {
      case 'high':
        return 'High Performance Device';
      case 'medium':
        return 'Medium Performance Device';
      case 'low':
        return 'Basic Performance Device';
      case 'emergency':
        return 'Limited Performance Mode';
      default:
        return 'Unknown Performance Level';
    }
  };

  const getDeviceTierColor = (tier: string) => {
    switch (tier) {
      case 'high':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case 'medium':
        return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
      case 'low':
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'emergency':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  const recommendations = getRecommendedSettings();

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`} data-testid="performance-indicator">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getPerformanceStatusText()}
            </span>
          </div>
          
          {/* Quick quality indicator */}
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDeviceTierColor(deviceCapability.tier)}`} data-testid="quality-indicator">
            {getQualityDescription()}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Performance metrics summary */}
          <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <SignalIcon className="h-3 w-3" />
              <span>{Math.round(currentMetrics.fps)}fps</span>
            </div>
            <div className="flex items-center space-x-1">
              <CpuChipIcon className="h-3 w-3" />
              <span>{Math.round(currentMetrics.cpuLoad)}%</span>
            </div>
          </div>
          
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>
      
      {/* Expanded Details */}
      {isExpanded && showDetails && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Device Information */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Device Capability
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Performance Tier:</span>
                <div className={`mt-1 px-2 py-1 rounded text-xs font-medium inline-block ${getDeviceTierColor(deviceCapability.tier)}`}>
                  {getDeviceTierDescription(deviceCapability.tier)}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">CPU Cores:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {deviceCapability.cpuCores}
                </div>
              </div>
              {deviceCapability.memoryGB && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Memory:</span>
                  <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                    {deviceCapability.memoryGB} GB
                  </div>
                </div>
              )}
              <div>
                <span className="text-gray-500 dark:text-gray-400">Performance Score:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {Math.round(deviceCapability.performanceScore)}/100
                </div>
              </div>
            </div>
          </div>
          
          {/* Audio Quality Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Audio Quality Settings
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Sample Rate:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {(qualitySettings.sampleRate / 1000).toFixed(1)} kHz
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Bitrate:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {(qualitySettings.bitrate / 1000)} kbps
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Codec:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1 text-xs">
                  {qualitySettings.codec.split(';')[0]}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Animation FPS:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {qualitySettings.animationFPS}
                </div>
              </div>
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Performance
            </h4>
            <div className="space-y-2">
              {/* Frame Rate */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Frame Rate</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {Math.round(currentMetrics.fps)} fps
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      currentMetrics.fps >= 50 ? 'bg-green-500' :
                      currentMetrics.fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (currentMetrics.fps / 60) * 100)}%` }}
                  />
                </div>
              </div>
              
              {/* CPU Load */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">CPU Load</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {Math.round(currentMetrics.cpuLoad)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      currentMetrics.cpuLoad <= 40 ? 'bg-green-500' :
                      currentMetrics.cpuLoad <= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${currentMetrics.cpuLoad}%` }}
                  />
                </div>
              </div>
              
              {/* Audio Latency */}
              {currentMetrics.audioLatency > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Audio Latency</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {currentMetrics.audioLatency.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        currentMetrics.audioLatency <= 10 ? 'bg-green-500' :
                        currentMetrics.audioLatency <= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (currentMetrics.audioLatency / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Memory Pressure Indicator */}
              {currentMetrics.memoryPressure && (
                <div className="flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>Memory pressure detected</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Enabled Features */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enabled Features
            </h4>
            <div className="flex flex-wrap gap-2">
              {qualitySettings.enableVisualization && (
                <div className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs">
                  Audio Visualization
                </div>
              )}
              {qualitySettings.enableSpeechRecognition && (
                <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs">
                  Speech Recognition
                </div>
              )}
              {qualitySettings.enableDebugLogging && (
                <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-xs">
                  Debug Logging
                </div>
              )}
              {!qualitySettings.enableVisualization && !qualitySettings.enableSpeechRecognition && (
                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 rounded text-xs">
                  Audio Recording Only
                </div>
              )}
            </div>
          </div>
          
          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceIndicator;