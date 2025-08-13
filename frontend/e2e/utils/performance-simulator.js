/**
 * Performance simulation utilities for testing adaptive performance scaling
 */

export class PerformanceSimulator {
  constructor(page) {
    this.page = page;
  }

  /**
   * Simulate different device performance tiers
   */
  async simulateDevicePerformance(tier) {
    const profiles = {
      high: {
        cpuThrottling: 1,
        networkThrottling: null,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        performanceScore: 85
      },
      medium: {
        cpuThrottling: 2,
        networkThrottling: null,
        hardwareConcurrency: 4,
        deviceMemory: 4,
        performanceScore: 55
      },
      low: {
        cpuThrottling: 4,
        networkThrottling: null,
        hardwareConcurrency: 2,
        deviceMemory: 2,
        performanceScore: 30
      },
      emergency: {
        cpuThrottling: 8,
        networkThrottling: null,
        hardwareConcurrency: 1,
        deviceMemory: 1,
        performanceScore: 15
      }
    };

    const profile = profiles[tier];
    if (!profile) {
      throw new Error(`Unknown performance tier: ${tier}`);
    }

    try {
      // Check if page is still valid before creating CDP session
      if (this.page.isClosed()) {
        console.warn('[PerformanceSimulator] Page is closed, skipping CDP operations');
        return;
      }

      // Apply CPU throttling with error handling
      const client = await this.page.context().newCDPSession(this.page);
      await client.send('Emulation.setCPUThrottlingRate', { 
        rate: profile.cpuThrottling 
      });
      console.log(`[PerformanceSimulator] Applied CPU throttling: ${profile.cpuThrottling}x`);
    } catch (error) {
      console.warn(`[PerformanceSimulator] CDP operations failed: ${error.message}`);
      // Continue with other operations even if CDP fails
    }

    // Mock navigator properties for device capability detection
    await this.page.addInitScript(({ hardwareConcurrency, deviceMemory, performanceScore }) => {
      // Override navigator.hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: false,
        value: hardwareConcurrency
      });

      // Override navigator.deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: false,
        value: deviceMemory
      });

      // Mock performance benchmark results
      const originalNow = performance.now;
      let benchmarkCallCount = 0;
      performance.now = function() {
        benchmarkCallCount++;
        // Simulate slower benchmark results for lower performance tiers
        if (benchmarkCallCount > 2 && benchmarkCallCount < 10) {
          // During benchmark execution, return slower times for lower scores
          const baseDuration = originalNow.call(this);
          const slowdownFactor = Math.max(1, (100 - performanceScore) / 20);
          return baseDuration * slowdownFactor;
        }
        return originalNow.call(this);
      };

      console.log(`[PerformanceSimulator] Simulating ${hardwareConcurrency} cores, ${deviceMemory}GB RAM, score: ${performanceScore}`);
    }, profile);

    return profile;
  }

  /**
   * Simulate dynamic performance degradation
   */
  async simulatePerformanceDegradation(fromTier, toTier, gradual = true) {
    console.log(`[PerformanceSimulator] Degrading performance from ${fromTier} to ${toTier}`);
    
    if (gradual) {
      // Gradually increase CPU throttling
      const steps = 5;
      const fromProfile = await this.simulateDevicePerformance(fromTier);
      const toProfile = await this.simulateDevicePerformance(toTier);
      
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const currentThrottling = fromProfile.cpuThrottling + 
          (toProfile.cpuThrottling - fromProfile.cpuThrottling) * progress;
        
        const client = await this.page.context().newCDPSession(this.page);
        await client.send('Emulation.setCPUThrottlingRate', { 
          rate: currentThrottling 
        });
        
        await this.page.waitForTimeout(500); // Wait between steps
      }
    } else {
      // Immediate switch
      await this.simulateDevicePerformance(toTier);
    }
  }

  /**
   * Simulate memory pressure
   */
  async simulateMemoryPressure(enable = true) {
    await this.page.addInitScript((enable) => {
      if (enable) {
        // Mock performance.memory to show high usage
        if (performance.memory) {
          Object.defineProperty(performance, 'memory', {
            value: {
              usedJSHeapSize: 100 * 1024 * 1024, // 100MB
              totalJSHeapSize: 120 * 1024 * 1024, // 120MB (83% usage)
              jsHeapSizeLimit: 2048 * 1024 * 1024
            },
            writable: false
          });
        }
        console.log('[PerformanceSimulator] Memory pressure enabled');
      }
    }, enable);
  }

  /**
   * Monitor frame rate during test execution
   */
  async monitorFrameRate(durationMs = 5000) {
    const frameRates = [];
    
    await this.page.evaluate(async (durationMs) => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        const frameRates = [];
        
        function countFrame() {
          frameCount++;
          const currentTime = performance.now();
          
          if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            frameRates.push(fps);
            frameCount = 0;
            lastTime = currentTime;
          }
          
          if (currentTime - lastTime < durationMs) {
            requestAnimationFrame(countFrame);
          } else {
            window.__testFrameRates = frameRates;
            resolve(frameRates);
          }
        }
        
        requestAnimationFrame(countFrame);
      });
    }, durationMs);
    
    const rates = await this.page.evaluate(() => window.__testFrameRates || []);
    return rates;
  }

  /**
   * Reset performance to normal
   */
  async resetPerformance() {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log('[PerformanceSimulator] Performance reset to normal');
  }

  /**
   * Wait for performance manager to detect changes
   */
  async waitForPerformanceDetection(expectedTier, timeout = 10000) {
    await this.page.waitForFunction(
      (expectedTier) => {
        const indicator = document.querySelector('[data-testid="performance-indicator"]');
        if (!indicator) return false;
        
        const tierText = indicator.textContent.toLowerCase();
        return tierText.includes(expectedTier.toLowerCase());
      },
      expectedTier,
      { timeout }
    );
  }

  /**
   * Get current performance metrics from the page
   */
  async getCurrentPerformanceMetrics() {
    return await this.page.evaluate(() => {
      // Try to access the performance manager from the global scope
      const performanceData = window.__performanceManager || {};
      return {
        deviceTier: performanceData.deviceTier || 'unknown',
        currentFPS: performanceData.fps || 0,
        cpuLoad: performanceData.cpuLoad || 0,
        memoryPressure: performanceData.memoryPressure || false,
        qualitySettings: performanceData.qualitySettings || {}
      };
    });
  }

  /**
   * Inject performance data into global scope for testing
   */
  async exposePerformanceData() {
    await this.page.addInitScript(() => {
      // Intercept performance manager creation to expose data
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        return originalFetch.apply(this, args);
      };

      // Monitor for React component mounting
      let performanceManagerInterval;
      
      function checkForPerformanceManager() {
        // Look for performance manager in React dev tools or component state
        const reactFiber = document.querySelector('[data-reactroot]')?._reactInternalFiber;
        if (reactFiber) {
          // Try to find performance manager in component tree
          try {
            // This is a simplified approach - in reality we'd need to traverse the fiber tree
            window.__performanceManager = {
              detected: true,
              timestamp: Date.now()
            };
          } catch (e) {
            // Ignore errors
          }
        }
      }

      performanceManagerInterval = setInterval(checkForPerformanceManager, 100);
      
      // Clean up after 30 seconds
      setTimeout(() => {
        clearInterval(performanceManagerInterval);
      }, 30000);
    });
  }
}

/**
 * Device emulation profiles for testing
 */
export const DEVICE_PROFILES = {
  HIGH_PERFORMANCE_DESKTOP: {
    name: 'High Performance Desktop',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    performance: 'high'
  },
  
  MEDIUM_PERFORMANCE_LAPTOP: {
    name: 'Medium Performance Laptop',
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    performance: 'medium'
  },
  
  LOW_PERFORMANCE_DEVICE: {
    name: 'Low Performance Device',
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    performance: 'low'
  },
  
  EMERGENCY_MODE_DEVICE: {
    name: 'Emergency Mode Device',
    viewport: { width: 800, height: 600 },
    userAgent: 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    performance: 'emergency'
  }
};

/**
 * Helper function to create performance simulator instance
 */
export function createPerformanceSimulator(page) {
  return new PerformanceSimulator(page);
}