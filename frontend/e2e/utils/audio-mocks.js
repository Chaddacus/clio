/**
 * Audio API mocking utilities for testing audio recording functionality
 */

export class AudioMocker {
  constructor(page) {
    this.page = page;
  }

  /**
   * Setup mock audio APIs
   */
  async setupAudioMocks(options = {}) {
    const {
      enableMicrophone = true,
      simulateAudioLevel = 0.5,
      audioFormat = 'audio/webm',
      recordingDuration = 5000,
      simulateError = false
    } = options;

    await this.page.addInitScript(({
      enableMicrophone,
      simulateAudioLevel,
      audioFormat,
      recordingDuration,
      simulateError
    }) => {
      console.log('[AudioMocker] Setting up audio mocks');

      // Mock getUserMedia
      if (navigator.mediaDevices) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        
        navigator.mediaDevices.getUserMedia = async function(constraints) {
          if (simulateError) {
            throw new Error('NotAllowedError: Permission denied');
          }

          if (!enableMicrophone) {
            throw new Error('NotFoundError: No microphone found');
          }

          console.log('[AudioMocker] Mocking getUserMedia with constraints:', constraints);

          // Create mock audio stream
          const mockStream = new MediaStream();
          
          // Create mock audio track
          const mockAudioTrack = {
            kind: 'audio',
            enabled: true,
            muted: false,
            readyState: 'live',
            stop: () => {
              console.log('[AudioMocker] Mock audio track stopped');
            },
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
            getSettings: () => ({
              sampleRate: constraints.audio?.sampleRate || 44100,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            })
          };

          // Add mock track to stream
          mockStream.addTrack = () => {};
          mockStream.getTracks = () => [mockAudioTrack];
          mockStream.getAudioTracks = () => [mockAudioTrack];
          mockStream.removeTrack = () => {};
          
          return mockStream;
        };
      }

      // Mock MediaRecorder
      if (window.MediaRecorder) {
        const OriginalMediaRecorder = window.MediaRecorder;
        
        window.MediaRecorder = class MockMediaRecorder {
          constructor(stream, options = {}) {
            console.log('[AudioMocker] Creating MockMediaRecorder with options:', options);
            
            this.stream = stream;
            this.options = options;
            this.state = 'inactive';
            this.mimeType = options.mimeType || audioFormat;
            this.recordingChunks = [];
            
            this.ondataavailable = null;
            this.onstop = null;
            this.onstart = null;
            this.onerror = null;
            this.onpause = null;
            this.onresume = null;
          }

          start(timeslice = 1000) {
            if (this.state !== 'inactive') {
              throw new Error('InvalidStateError: MediaRecorder not inactive');
            }

            console.log('[AudioMocker] Starting mock recording');
            this.state = 'recording';
            
            if (this.onstart) {
              this.onstart(new Event('start'));
            }

            // Simulate data chunks
            this.dataInterval = setInterval(() => {
              if (this.state === 'recording') {
                const mockData = this.generateMockAudioData();
                const dataEvent = new Event('dataavailable');
                dataEvent.data = mockData;
                
                if (this.ondataavailable) {
                  this.ondataavailable(dataEvent);
                }
              }
            }, timeslice);

            // Auto-stop after duration (for testing)
            if (recordingDuration > 0) {
              setTimeout(() => {
                if (this.state !== 'inactive') {
                  this.stop();
                }
              }, recordingDuration);
            }
          }

          stop() {
            if (this.state === 'inactive') {
              return;
            }

            console.log('[AudioMocker] Stopping mock recording');
            this.state = 'inactive';
            
            if (this.dataInterval) {
              clearInterval(this.dataInterval);
            }

            // Generate final mock data
            const finalData = this.generateMockAudioData();
            const stopEvent = new Event('stop');
            
            if (this.onstop) {
              this.onstop(stopEvent);
            }
          }

          pause() {
            if (this.state !== 'recording') {
              throw new Error('InvalidStateError: MediaRecorder not recording');
            }

            console.log('[AudioMocker] Pausing mock recording');
            this.state = 'paused';
            
            if (this.onpause) {
              this.onpause(new Event('pause'));
            }
          }

          resume() {
            if (this.state !== 'paused') {
              throw new Error('InvalidStateError: MediaRecorder not paused');
            }

            console.log('[AudioMocker] Resuming mock recording');
            this.state = 'recording';
            
            if (this.onresume) {
              this.onresume(new Event('resume'));
            }
          }

          generateMockAudioData() {
            // Generate mock audio blob
            const duration = 1; // 1 second of audio data
            const sampleRate = 44100;
            const channels = 1;
            const samples = sampleRate * duration;
            
            // Create mock WAV data
            const arrayBuffer = new ArrayBuffer(samples * 2);
            const view = new DataView(arrayBuffer);
            
            // Generate simple sine wave
            for (let i = 0; i < samples; i++) {
              const amplitude = simulateAudioLevel * 32767;
              const frequency = 440; // A4 note
              const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
              view.setInt16(i * 2, sample, true);
            }
            
            return new Blob([arrayBuffer], { type: this.mimeType });
          }

          static isTypeSupported(mimeType) {
            const supportedTypes = ['audio/webm', 'audio/wav', 'audio/mp4'];
            return supportedTypes.includes(mimeType);
          }
        };

        // Copy static methods
        window.MediaRecorder.isTypeSupported = window.MediaRecorder.prototype.constructor.isTypeSupported;
      }

      // Mock AudioContext for audio analysis
      if (window.AudioContext) {
        const OriginalAudioContext = window.AudioContext;
        
        window.AudioContext = class MockAudioContext {
          constructor() {
            console.log('[AudioMocker] Creating MockAudioContext');
            this.state = 'suspended';
            this.sampleRate = 44100;
            this.currentTime = 0;
            this.destination = {};
          }

          async resume() {
            console.log('[AudioMocker] Resuming MockAudioContext');
            this.state = 'running';
            return Promise.resolve();
          }

          async suspend() {
            console.log('[AudioMocker] Suspending MockAudioContext');
            this.state = 'suspended';
            return Promise.resolve();
          }

          async close() {
            console.log('[AudioMocker] Closing MockAudioContext');
            this.state = 'closed';
            return Promise.resolve();
          }

          createAnalyser() {
            return new MockAnalyserNode();
          }

          createMediaStreamSource(stream) {
            return new MockMediaStreamSource(stream);
          }
        };
      }

      // Mock AnalyserNode
      class MockAnalyserNode {
        constructor() {
          this.fftSize = 256;
          this.frequencyBinCount = this.fftSize / 2;
          this.smoothingTimeConstant = 0.8;
          this.maxDecibels = -30;
          this.minDecibels = -100;
        }

        connect(destination) {
          console.log('[AudioMocker] Connecting analyser to destination');
        }

        getByteFrequencyData(array) {
          // Generate mock frequency data with simulated audio levels
          for (let i = 0; i < array.length; i++) {
            const baseLevel = simulateAudioLevel * 255;
            const variation = (Math.random() - 0.5) * 50;
            array[i] = Math.max(0, Math.min(255, baseLevel + variation));
          }
        }

        getByteTimeDomainData(array) {
          // Generate mock time domain data
          for (let i = 0; i < array.length; i++) {
            const sample = Math.sin(2 * Math.PI * 440 * i / array.length) * simulateAudioLevel;
            array[i] = Math.round((sample + 1) * 127.5);
          }
        }
      }

      // Mock MediaStreamSource
      class MockMediaStreamSource {
        constructor(stream) {
          this.stream = stream;
          console.log('[AudioMocker] Creating MockMediaStreamSource');
        }

        connect(destination) {
          console.log('[AudioMocker] Connecting MediaStreamSource');
        }
      }

      // Mock permissions API
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = async function(permissionDesc) {
          if (permissionDesc.name === 'microphone') {
            return {
              state: enableMicrophone ? 'granted' : 'denied',
              addEventListener: () => {},
              removeEventListener: () => {}
            };
          }
          return originalQuery ? originalQuery.call(this, permissionDesc) : { state: 'granted' };
        };
      }

      console.log('[AudioMocker] Audio mocks setup complete');
    }, {
      enableMicrophone,
      simulateAudioLevel,
      audioFormat,
      recordingDuration,
      simulateError
    });
  }

  /**
   * Simulate changing audio levels during recording
   */
  async simulateAudioLevelChanges(levels, intervalMs = 1000) {
    for (const level of levels) {
      await this.page.evaluate((newLevel) => {
        window.__mockAudioLevel = newLevel;
        console.log(`[AudioMocker] Changed audio level to ${newLevel}`);
      }, level);
      
      await this.page.waitForTimeout(intervalMs);
    }
  }

  /**
   * Simulate microphone permission changes
   */
  async simulatePermissionChange(granted) {
    await this.page.evaluate((granted) => {
      // Trigger permission change
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'microphone' }).then(result => {
          result.state = granted ? 'granted' : 'denied';
          if (result.onchange) {
            result.onchange();
          }
        });
      }
      console.log(`[AudioMocker] Permission changed to ${granted ? 'granted' : 'denied'}`);
    }, granted);
  }

  /**
   * Verify audio recording started
   */
  async waitForRecordingStart(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        // Look for recording indicators
        const recordButton = document.querySelector('[title="Start Recording"]');
        const isRecordingIndicator = document.querySelector('.animate-pulse');
        const recordingStatus = document.querySelector('[data-testid="recording-status"]');
        
        return !recordButton || isRecordingIndicator || 
               (recordingStatus && recordingStatus.textContent.includes('Recording'));
      },
      { timeout }
    );
  }

  /**
   * Wait for recording to complete
   */
  async waitForRecordingComplete(timeout = 10000) {
    await this.page.waitForFunction(
      () => {
        const stopButton = document.querySelector('[title="Stop Recording"]');
        const recordingComplete = document.querySelector('[data-testid="recording-complete"]');
        const audioPlayer = document.querySelector('audio[controls]');
        
        return !stopButton || recordingComplete || audioPlayer;
      },
      { timeout }
    );
  }

  /**
   * Get current recording state
   */
  async getRecordingState() {
    return await this.page.evaluate(() => {
      const recordButton = document.querySelector('[title="Start Recording"]');
      const stopButton = document.querySelector('[title="Stop Recording"]');
      const pauseButton = document.querySelector('[title="Pause Recording"]');
      const recordingTime = document.querySelector('[data-testid="recording-time"]');
      
      return {
        isRecording: !!stopButton,
        isPaused: !!pauseButton && pauseButton.style.display !== 'none',
        hasRecordButton: !!recordButton,
        recordingTime: recordingTime ? recordingTime.textContent : null
      };
    });
  }
}

/**
 * Helper function to create audio mocker instance
 */
export function createAudioMocker(page) {
  return new AudioMocker(page);
}