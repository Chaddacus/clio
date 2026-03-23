export interface DeviceCapability {
  tier: 'high' | 'medium' | 'low' | 'emergency';
  cpuCores: number;
  memoryGB: number | null;
  performanceScore: number;
  supportedFeatures: string[];
}

export interface PerformanceMetrics {
  fps: number;
  cpuLoad: number;
  memoryPressure: boolean;
  audioLatency: number;
  isTabVisible: boolean;
}

export interface QualitySettings {
  sampleRate: number;
  bitrate: number;
  codec: string;
  enableVisualization: boolean;
  enableSpeechRecognition: boolean;
  animationFPS: number;
  audioAnalysisInterval: number;
  enableDebugLogging: boolean;
}

export class PerformanceManager {
  private deviceCapability: DeviceCapability | null = null;
  private currentMetrics: PerformanceMetrics;
  private qualitySettings: QualitySettings;
  private frameRateMonitor: FrameRateMonitor;
  private performanceCallbacks: Array<(metrics: PerformanceMetrics) => void> = [];
  private qualityChangeCallbacks: Array<(settings: QualitySettings) => void> = [];
  private isMonitoring = false;

  constructor() {
    this.frameRateMonitor = new FrameRateMonitor();
    this.currentMetrics = this.getInitialMetrics();
    this.qualitySettings = this.getDefaultQualitySettings();
    this.detectDeviceCapability();
    this.setupVisibilityListener();
  }

  /**
   * Detect device capabilities and assign performance tier
   */
  private async detectDeviceCapability(): Promise<void> {
    const cpuCores = navigator.hardwareConcurrency || 2;
    const memoryGB = (navigator as any).deviceMemory || null;
    
    // Run a quick performance benchmark
    const performanceScore = await this.runPerformanceBenchmark();
    
    // Determine performance tier based on capabilities
    let tier: DeviceCapability['tier'];
    let supportedFeatures: string[] = ['recording'];

    if (cpuCores >= 8 && (memoryGB === null || memoryGB >= 8) && performanceScore >= 80) {
      tier = 'high';
      supportedFeatures = ['recording', 'visualization', 'speechRecognition', 'analytics', 'debugLogging'];
    } else if (cpuCores >= 4 && (memoryGB === null || memoryGB >= 4) && performanceScore >= 50) {
      tier = 'medium';
      supportedFeatures = ['recording', 'visualization', 'throttledSpeechRecognition'];
    } else if (cpuCores >= 2 && performanceScore >= 25) {
      tier = 'low';
      supportedFeatures = ['recording', 'basicVisualization'];
    } else {
      tier = 'emergency';
      supportedFeatures = ['recording'];
    }

    this.deviceCapability = {
      tier,
      cpuCores,
      memoryGB,
      performanceScore,
      supportedFeatures
    };

    // Set initial quality settings based on capability
    this.qualitySettings = this.getQualitySettingsForTier(tier);
  }

  /**
   * Run a simple performance benchmark
   */
  private async runPerformanceBenchmark(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const iterations = 100000;
      
      // CPU benchmark: Simple math operations
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i / 1000);
      }
      
      const cpuTime = performance.now() - startTime;
      
      // Canvas benchmark: Drawing operations
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const canvasStartTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
          ctx.fillStyle = `hsl(${i % 360}, 50%, 50%)`;
          ctx.fillRect(Math.random() * 300, Math.random() * 150, 10, 10);
        }
        
        const canvasTime = performance.now() - canvasStartTime;
        
        // Combined score (lower times = higher scores)
        const cpuScore = Math.max(0, 100 - cpuTime);
        const canvasScore = Math.max(0, 100 - canvasTime);
        const combinedScore = Math.min(100, (cpuScore + canvasScore) / 2);
        
        resolve(combinedScore);
      } else {
        // Fallback if canvas not available
        const score = Math.max(0, 100 - cpuTime);
        resolve(score);
      }
      
      // Clean up
      canvas.remove();
    });
  }

  /**
   * Get quality settings for a specific performance tier
   */
  private getQualitySettingsForTier(tier: DeviceCapability['tier']): QualitySettings {
    switch (tier) {
      case 'high':
        return {
          sampleRate: 48000,
          bitrate: 128000,
          codec: 'audio/webm;codecs=opus',
          enableVisualization: true,
          enableSpeechRecognition: true,
          animationFPS: 60,
          audioAnalysisInterval: 16, // ~60fps
          enableDebugLogging: true
        };
      
      case 'medium':
        return {
          sampleRate: 44100,
          bitrate: 96000,
          codec: 'audio/webm;codecs=opus',
          enableVisualization: true,
          enableSpeechRecognition: true,
          animationFPS: 30,
          audioAnalysisInterval: 33, // ~30fps
          enableDebugLogging: false
        };
      
      case 'low':
        return {
          sampleRate: 22050,
          bitrate: 64000,
          codec: 'audio/webm',
          enableVisualization: true,
          enableSpeechRecognition: false,
          animationFPS: 15,
          audioAnalysisInterval: 67, // ~15fps
          enableDebugLogging: false
        };
      
      case 'emergency':
        return {
          sampleRate: 16000,
          bitrate: 32000,
          codec: 'audio/webm',
          enableVisualization: false,
          enableSpeechRecognition: false,
          animationFPS: 0,
          audioAnalysisInterval: 1000, // 1fps
          enableDebugLogging: false
        };
    }
  }

  /**
   * Start monitoring performance metrics
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.frameRateMonitor.start();
    
    // Monitor performance every 2 seconds
    const monitoringInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(monitoringInterval);
        return;
      }
      
      this.updatePerformanceMetrics();
      this.checkForPerformanceDegradation();
      
      // Notify callbacks
      this.performanceCallbacks.forEach(callback => {
        callback(this.currentMetrics);
      });
      
    }, 2000);
    
    // console.log('[PerformanceManager] Started performance monitoring'); // DISABLED for debugging
  }

  /**
   * Stop monitoring performance
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    this.frameRateMonitor.stop();
    // console.log('[PerformanceManager] Stopped performance monitoring'); // DISABLED for debugging
  }

  /**
   * Update current performance metrics
   */
  private updatePerformanceMetrics(): void {
    this.currentMetrics = {
      fps: this.frameRateMonitor.getCurrentFPS(),
      cpuLoad: this.estimateCPULoad(),
      memoryPressure: this.detectMemoryPressure(),
      audioLatency: 0, // Will be updated by audio recorder
      isTabVisible: !document.hidden
    };
  }

  /**
   * Check if performance has degraded and adjust settings
   */
  private checkForPerformanceDegradation(): void {
    const { fps, cpuLoad, memoryPressure } = this.currentMetrics;
    let needsDowngrade = false;
    let needsUpgrade = false;
    
    // Check for performance issues
    if (fps < 20 || cpuLoad > 80 || memoryPressure) {
      needsDowngrade = true;
    }
    
    // Check if we can upgrade quality
    if (fps > 50 && cpuLoad < 40 && !memoryPressure) {
      needsUpgrade = true;
    }
    
    if (needsDowngrade) {
      this.downgradeQuality();
    } else if (needsUpgrade && this.canUpgradeQuality()) {
      this.upgradeQuality();
    }
  }

  /**
   * Downgrade quality settings to improve performance
   */
  private downgradeQuality(): void {
    const currentTier = this.getCurrentTier();
    let newSettings = { ...this.qualitySettings };
    
    // Progressive degradation steps
    if (newSettings.animationFPS > 15) {
      newSettings.animationFPS = Math.max(15, newSettings.animationFPS / 2);
      newSettings.audioAnalysisInterval *= 2;
    } else if (newSettings.enableSpeechRecognition) {
      newSettings.enableSpeechRecognition = false;
    } else if (newSettings.sampleRate > 16000) {
      newSettings.sampleRate = Math.max(16000, newSettings.sampleRate / 2);
      newSettings.bitrate = Math.max(32000, newSettings.bitrate / 2);
    } else if (newSettings.enableVisualization) {
      newSettings.enableVisualization = false;
      newSettings.animationFPS = 0;
    }
    
    if (JSON.stringify(newSettings) !== JSON.stringify(this.qualitySettings)) {
      // console.log('[PerformanceManager] Downgrading quality due to performance issues:', { // DISABLED for debugging
      //   fps: this.currentMetrics.fps,
      //   cpuLoad: this.currentMetrics.cpuLoad,
      //   memoryPressure: this.currentMetrics.memoryPressure
      // });
      
      this.updateQualitySettings(newSettings);
    }
  }

  /**
   * Upgrade quality settings when performance allows
   */
  private upgradeQuality(): void {
    if (!this.deviceCapability) return;
    
    const optimalSettings = this.getQualitySettingsForTier(this.deviceCapability.tier);
    let newSettings = { ...this.qualitySettings };
    let upgraded = false;
    
    // Progressive upgrade steps
    if (!newSettings.enableVisualization && optimalSettings.enableVisualization) {
      newSettings.enableVisualization = true;
      newSettings.animationFPS = 15;
      upgraded = true;
    } else if (newSettings.sampleRate < optimalSettings.sampleRate) {
      newSettings.sampleRate = Math.min(optimalSettings.sampleRate, newSettings.sampleRate * 2);
      newSettings.bitrate = Math.min(optimalSettings.bitrate, newSettings.bitrate * 2);
      upgraded = true;
    } else if (!newSettings.enableSpeechRecognition && optimalSettings.enableSpeechRecognition) {
      newSettings.enableSpeechRecognition = true;
      upgraded = true;
    } else if (newSettings.animationFPS < optimalSettings.animationFPS) {
      newSettings.animationFPS = Math.min(optimalSettings.animationFPS, newSettings.animationFPS * 2);
      newSettings.audioAnalysisInterval = Math.max(optimalSettings.audioAnalysisInterval, newSettings.audioAnalysisInterval / 2);
      upgraded = true;
    }
    
    if (upgraded) {
      // console.log('[PerformanceManager] Upgrading quality due to improved performance'); // DISABLED for debugging
      this.updateQualitySettings(newSettings);
    }
  }

  /**
   * Update quality settings and notify callbacks
   */
  private updateQualitySettings(newSettings: QualitySettings): void {
    this.qualitySettings = newSettings;
    
    this.qualityChangeCallbacks.forEach(callback => {
      callback(this.qualitySettings);
    });
  }

  /**
   * Get current performance tier based on current settings
   */
  private getCurrentTier(): DeviceCapability['tier'] {
    if (this.qualitySettings.sampleRate >= 44100 && this.qualitySettings.enableVisualization && this.qualitySettings.enableSpeechRecognition) {
      return 'high';
    } else if (this.qualitySettings.sampleRate >= 22050 && this.qualitySettings.enableVisualization) {
      return 'medium';
    } else if (this.qualitySettings.enableVisualization) {
      return 'low';
    } else {
      return 'emergency';
    }
  }

  /**
   * Check if quality can be upgraded
   */
  private canUpgradeQuality(): boolean {
    if (!this.deviceCapability) return false;
    const currentTier = this.getCurrentTier();
    return currentTier !== this.deviceCapability.tier;
  }

  /**
   * Estimate CPU load (simplified)
   */
  private estimateCPULoad(): number {
    // This is a simplified estimation based on frame rate
    const targetFPS = 60;
    const currentFPS = this.currentMetrics.fps;
    return Math.max(0, Math.min(100, ((targetFPS - currentFPS) / targetFPS) * 100));
  }

  /**
   * Detect memory pressure (simplified)
   */
  private detectMemoryPressure(): boolean {
    // Check if memory API is available
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize;
      const totalMemory = memory.totalJSHeapSize;
      const memoryUsage = usedMemory / totalMemory;
      
      return memoryUsage > 0.8; // 80% memory usage threshold
    }
    
    // Fallback: assume no memory pressure if we can't measure
    return false;
  }

  /**
   * Set up document visibility listener
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      this.currentMetrics.isTabVisible = !document.hidden;
      
      if (document.hidden) {
        // Tab is hidden, reduce performance requirements
        // console.log('[PerformanceManager] Tab hidden, reducing performance requirements'); // DISABLED for debugging
      } else {
        // Tab is visible, restore performance
        // console.log('[PerformanceManager] Tab visible, restoring performance'); // DISABLED for debugging
      }
    });
  }

  /**
   * Get initial metrics
   */
  private getInitialMetrics(): PerformanceMetrics {
    return {
      fps: 60,
      cpuLoad: 0,
      memoryPressure: false,
      audioLatency: 0,
      isTabVisible: !document.hidden
    };
  }

  /**
   * Get default quality settings
   */
  private getDefaultQualitySettings(): QualitySettings {
    return this.getQualitySettingsForTier('medium');
  }

  // Public API methods

  public getDeviceCapability(): DeviceCapability | null {
    return this.deviceCapability;
  }

  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  public getCurrentQualitySettings(): QualitySettings {
    return { ...this.qualitySettings };
  }

  public onPerformanceChange(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.performanceCallbacks.push(callback);
    return () => {
      const index = this.performanceCallbacks.indexOf(callback);
      if (index > -1) {
        this.performanceCallbacks.splice(index, 1);
      }
    };
  }

  public onQualityChange(callback: (settings: QualitySettings) => void): () => void {
    this.qualityChangeCallbacks.push(callback);
    return () => {
      const index = this.qualityChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.qualityChangeCallbacks.splice(index, 1);
      }
    };
  }

  public forceQualityTier(tier: DeviceCapability['tier']): void {
    const newSettings = this.getQualitySettingsForTier(tier);
    this.updateQualitySettings(newSettings);
  }

  public updateAudioLatency(latency: number): void {
    this.currentMetrics.audioLatency = latency;
  }
}

/**
 * Frame rate monitor class
 */
class FrameRateMonitor {
  private isRunning = false;
  private fps = 60;
  private frameCount = 0;
  private startTime = 0;
  private animationFrame: number | null = null;

  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.frameCount = 0;
    this.startTime = performance.now();
    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  public getCurrentFPS(): number {
    return this.fps;
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.startTime;
    
    // Update FPS every second
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.startTime = currentTime;
    }
    
    this.animationFrame = requestAnimationFrame(this.tick);
  };
}