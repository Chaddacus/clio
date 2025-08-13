const { test, expect } = require('@playwright/test');

test.describe('Enhanced Recording Debug Logs', () => {
  test('Capture comprehensive MediaRecorder debug logs', async ({ page, context }) => {
    console.log('🔍 Starting enhanced debug log capture...');

    // Mock getUserMedia with a more realistic stream
    await page.addInitScript(() => {
      console.log('[MOCK] Setting up enhanced getUserMedia mock...');
      
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async (constraints) => {
            console.log('[MOCK] getUserMedia called with:', JSON.stringify(constraints, null, 2));
            
            // Create a more realistic mock stream
            const mockStream = {
              id: 'mock-stream-' + Date.now(),
              active: true,
              getTracks: () => {
                return [mockAudioTrack];
              },
              getAudioTracks: () => {
                return [mockAudioTrack];
              },
              getVideoTracks: () => {
                return [];
              },
              addTrack: () => {},
              removeTrack: () => {},
              clone: () => mockStream
            };
            
            // Create a realistic mock audio track
            const mockAudioTrack = {
              id: 'mock-audio-track-' + Date.now(),
              kind: 'audio',
              label: 'Mock Microphone Audio Track',
              enabled: true,
              readyState: 'live',
              muted: false,
              
              // Add event listener support
              _listeners: {},
              addEventListener: function(event, callback) {
                console.log('[MOCK] Track addEventListener:', event);
                if (!this._listeners[event]) {
                  this._listeners[event] = [];
                }
                this._listeners[event].push(callback);
              },
              removeEventListener: function(event, callback) {
                if (this._listeners[event]) {
                  this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
                }
              },
              
              // Methods
              stop: () => {
                console.log('[MOCK] Track stop() called');
                mockAudioTrack.readyState = 'ended';
                // Trigger ended event after a delay to simulate track ending
                setTimeout(() => {
                  if (mockAudioTrack._listeners.ended) {
                    mockAudioTrack._listeners.ended.forEach(cb => {
                      console.log('[MOCK] Triggering track ended event');
                      cb();
                    });
                  }
                }, 50);
              },
              
              clone: () => mockAudioTrack,
              
              // Constraints
              getConstraints: () => constraints.audio || {},
              getCapabilities: () => ({
                sampleRate: { min: 8000, max: 48000 },
                sampleSize: { min: 8, max: 32 },
                echoCancellation: [true, false],
                noiseSuppression: [true, false],
                autoGainControl: [true, false]
              }),
              getSettings: () => ({
                sampleRate: 44100,
                sampleSize: 16,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              })
            };
            
            // Make the stream inherit from MediaStream prototype
            Object.setPrototypeOf(mockStream, MediaStream.prototype);
            
            console.log('[MOCK] Created mock MediaStream:', {
              id: mockStream.id,
              active: mockStream.active,
              trackCount: mockStream.getTracks().length,
              audioTrackCount: mockStream.getAudioTracks().length
            });
            
            return mockStream;
          }
        }
      });

      // Mock permissions
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: async ({ name }) => {
            console.log('[MOCK] Permission query for:', name);
            return {
              state: 'granted',
              addEventListener: () => {},
              removeEventListener: () => {}
            };
          }
        }
      });

      console.log('[MOCK] Enhanced mocks setup complete');
    });

    // Collect all console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(message);
    });

    // Login
    await page.goto('/login');
    try {
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Login handled');
    }

    // Navigate to record page
    await page.goto('/record');
    await page.waitForLoadState('networkidle');
    console.log('📍 Record page loaded');

    // Find and click main record button
    const recordButton = page.locator('[title="Start Recording"]').last();
    await expect(recordButton).toBeVisible();
    
    console.log('🎤 Clicking main record button...');
    await recordButton.click();
    
    // Wait longer to capture all the debug timing logs
    console.log('⏳ Waiting 5 seconds to capture all debug logs...');
    await page.waitForTimeout(5000);
    
    // Filter and organize the logs
    const relevantLogs = consoleMessages.filter(msg => 
      msg.text.includes('[useAudioRecorder]') ||
      msg.text.includes('[RecorderControls]') ||
      msg.text.includes('[MOCK]') ||
      msg.text.includes('MediaRecorder') ||
      msg.text.includes('Track') ||
      msg.text.includes('Stream')
    );

    console.log('\n🔍 COMPREHENSIVE DEBUG LOG ANALYSIS');
    console.log('==========================================');
    
    // Group logs by category
    const mockLogs = relevantLogs.filter(log => log.text.includes('[MOCK]'));
    const recorderControlsLogs = relevantLogs.filter(log => log.text.includes('[RecorderControls]'));
    const useAudioRecorderLogs = relevantLogs.filter(log => log.text.includes('[useAudioRecorder]'));
    const mediaRecorderLogs = relevantLogs.filter(log => 
      log.text.includes('MediaRecorder') && 
      (log.text.includes('ONSTART') || log.text.includes('ONSTOP') || log.text.includes('ONERROR'))
    );
    const trackLogs = relevantLogs.filter(log => 
      log.text.includes('Track') && 
      (log.text.includes('ended') || log.text.includes('muted') || log.text.includes('details'))
    );
    const stateTransitionLogs = relevantLogs.filter(log => 
      log.text.includes('state after') || log.text.includes('state before')
    );

    console.log('\n📡 MOCK SETUP LOGS:');
    mockLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n🎛️ RECORDER CONTROLS LOGS:');
    recorderControlsLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n🎵 AUDIO RECORDER HOOK LOGS:');
    useAudioRecorderLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n📊 MEDIARECORDER EVENT LOGS:');
    mediaRecorderLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n🔄 STATE TRANSITION LOGS:');
    stateTransitionLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n🎵 TRACK EVENT LOGS:');
    trackLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

    console.log('\n🔍 ANALYSIS SUMMARY:');
    console.log('==========================================');
    
    // Analyze the logs for timing issues
    const startEvents = mediaRecorderLogs.filter(log => log.text.includes('ONSTART'));
    const stopEvents = mediaRecorderLogs.filter(log => log.text.includes('ONSTOP'));
    const errorEvents = mediaRecorderLogs.filter(log => log.text.includes('ONERROR'));
    const trackEndedEvents = trackLogs.filter(log => log.text.includes('ended'));

    console.log(`📊 Event Counts:`);
    console.log(`  - ONSTART events: ${startEvents.length}`);
    console.log(`  - ONSTOP events: ${stopEvents.length}`);
    console.log(`  - ONERROR events: ${errorEvents.length}`);
    console.log(`  - Track ended events: ${trackEndedEvents.length}`);

    if (startEvents.length > 0 && stopEvents.length > 0) {
      // Extract timing information from the logs
      const startTime = startEvents[0].text.match(/timestamp: (\d+)/)?.[1];
      const stopTime = stopEvents[0].text.match(/timestamp: (\d+)/)?.[1];
      const duration = stopEvents[0].text.match(/recordingDuration: (\d+)/)?.[1];
      
      console.log(`⏱️ Timing Analysis:`);
      console.log(`  - Recording duration: ${duration}ms`);
      if (startTime && stopTime) {
        console.log(`  - Time between start and stop: ${stopTime - startTime}ms`);
      }
    }

    if (errorEvents.length > 0) {
      console.log(`❌ Errors Detected:`);
      errorEvents.forEach(err => {
        console.log(`  - ${err.text}`);
      });
    }

    if (trackEndedEvents.length > 0) {
      console.log(`🔚 Track Issues:`);
      trackEndedEvents.forEach(track => {
        console.log(`  - ${track.text}`);
      });
    }

    // Look for state transition patterns
    const stateChanges = stateTransitionLogs.map(log => {
      const stateMatch = log.text.match(/state.*?:\s*(\w+)/);
      const timingMatch = log.text.match(/after (\d+)ms/);
      return {
        state: stateMatch?.[1],
        timing: timingMatch?.[1],
        fullText: log.text
      };
    });

    if (stateChanges.length > 0) {
      console.log(`🔄 State Transition Pattern:`);
      stateChanges.forEach(change => {
        console.log(`  - ${change.timing ? `After ${change.timing}ms` : 'Immediate'}: ${change.state}`);
      });
    }

    console.log('\n🎯 DIAGNOSIS:');
    if (stopEvents.length > 0 && startEvents.length > 0) {
      const durationMatch = stopEvents[0].text.match(/recordingDuration: (\d+)/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
      
      if (duration < 100) {
        console.log('❌ ISSUE: Recording stops within 100ms - indicates immediate failure');
        console.log('   Likely causes: Track ended immediately, MediaRecorder error, or browser compatibility issue');
      } else if (duration < 1000) {
        console.log('⚠️  ISSUE: Recording stops within 1 second - indicates early failure');
        console.log('   Likely causes: Stream issues or MediaRecorder configuration problem');
      } else {
        console.log('✅ Recording duration appears normal');
      }
    }

    if (errorEvents.length > 0) {
      console.log('❌ ISSUE: MediaRecorder errors detected - check error messages above');
    }

    if (trackEndedEvents.length > 0) {
      console.log('❌ ISSUE: Audio tracks ended unexpectedly - stream became inactive');
    }

    console.log('\n==========================================');
    console.log('🔬 ENHANCED DEBUG LOG CAPTURE COMPLETED');
    console.log('==========================================\n');

    // Ensure we got some relevant logs
    expect(relevantLogs.length).toBeGreaterThan(0);
  });
});