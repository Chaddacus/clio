# Performance Scaling E2E Test Suite

This comprehensive test suite validates the adaptive performance scaling system for the Voice Notes application's audio recording functionality.

## 🎯 Test Objectives

The test suite ensures that:
- **No Page Freezing**: The application never becomes unresponsive during audio recording
- **Accurate Performance Detection**: Device capabilities are correctly identified (95%+ accuracy)
- **Smooth Quality Transitions**: Performance scaling occurs without interrupting recordings
- **Cross-Browser Compatibility**: Core functionality works across all major browsers
- **Responsive UI**: Interface remains functional under all performance conditions

## 📁 Test Structure

```
e2e/
├── tests/
│   ├── auth.setup.js              # Authentication setup for tests
│   ├── performance-scaling.spec.js # Core performance adaptation tests
│   ├── ui-components.spec.js       # UI component validation tests
│   ├── audio-recording.spec.js     # Audio quality and recording tests
│   └── cross-browser.spec.js       # Cross-browser compatibility tests
├── utils/
│   ├── performance-simulator.js    # Device performance emulation utilities
│   ├── audio-mocks.js             # Audio API mocking utilities
│   └── device-emulation.js        # Device capability simulation
├── page-objects/
│   ├── RecordPage.js              # Record page interactions
│   ├── Dashboard.js               # Dashboard page object
│   └── PerformanceIndicator.js    # Performance indicator component
├── fixtures/
│   ├── test-data.js               # Test data and configurations
│   └── performance-profiles.js    # Device performance profiles
└── run-performance-tests.sh       # Automated test runner script
```

## 🚀 Running Tests

### Prerequisites
1. **Docker Services**: Ensure Docker Compose services are running
   ```bash
   docker-compose up -d
   ```

2. **Install Dependencies**: Install Playwright and browsers
   ```bash
   npm install
   npx playwright install
   ```

### Running All Tests
```bash
# Run complete performance test suite
./e2e/run-performance-tests.sh

# Or run individual test suites
npm run test:e2e
```

### Running Specific Test Categories
```bash
# Performance scaling tests only
npx playwright test e2e/tests/performance-scaling.spec.js

# UI component validation
npx playwright test e2e/tests/ui-components.spec.js

# Audio recording quality tests
npx playwright test e2e/tests/audio-recording.spec.js

# Cross-browser compatibility
npx playwright test e2e/tests/cross-browser.spec.js
```

### Running Tests with UI Mode
```bash
npm run test:e2e:ui
```

## 📊 Test Categories

### 1. Performance Tier Detection Tests
**File**: `performance-scaling.spec.js`

Tests device capability detection and appropriate performance tier assignment:

- **High Performance**: 8+ cores, 8GB+ RAM → 48kHz, Opus codec, full features
- **Medium Performance**: 4+ cores, 4GB+ RAM → 44.1kHz, basic features  
- **Low Performance**: 2+ cores, <4GB RAM → 22kHz, minimal features
- **Emergency Mode**: Limited resources → 16kHz, audio-only

### 2. Dynamic Performance Scaling Tests
**File**: `performance-scaling.spec.js`

Validates real-time performance adaptation:

- **Quality Degradation**: Performance drops → automatic quality reduction
- **Quality Improvement**: Performance improves → feature restoration
- **Memory Pressure**: High memory usage → graceful feature disabling
- **Recording Continuity**: Quality changes don't interrupt recordings

### 3. UI Responsiveness Tests
**File**: `performance-scaling.spec.js` & `ui-components.spec.js`

Ensures interface remains responsive:

- **Frame Rate Monitoring**: Maintains >25fps on high performance, >10fps on low
- **Animation Throttling**: Reduces animation frequency based on performance
- **No Page Freezing**: Page never becomes unresponsive
- **Control Responsiveness**: Buttons remain clickable during performance stress

### 4. Component Validation Tests
**File**: `ui-components.spec.js`

Tests individual UI components across performance tiers:

- **PerformanceIndicator**: Shows correct tier, metrics, and recommendations
- **WaveformDisplay**: Adapts rendering quality based on performance
- **RecorderControls**: Maintains functionality across all performance levels
- **Audio Level Indicators**: Updates frequency adapts to device capabilities

### 5. Audio Quality Tests
**File**: `audio-recording.spec.js`

Validates audio recording functionality:

- **Codec Selection**: Prefers Opus on high performance, falls back appropriately
- **Sample Rate Scaling**: Uses appropriate sample rates per performance tier
- **Recording Workflow**: Complete record→save→transcribe flow on all tiers
- **Quality Preservation**: Recordings complete successfully despite performance changes

### 6. Cross-Browser Compatibility Tests
**File**: `cross-browser.spec.js`

Ensures consistent behavior across browsers:

- **Chrome/Chromium**: Full feature support testing
- **Firefox**: Codec compatibility and performance scaling
- **Safari/WebKit**: iOS-specific performance characteristics
- **Mobile Browsers**: Touch interface and resource constraints

## 🛠️ Test Utilities

### Performance Simulator
**File**: `utils/performance-simulator.js`

```javascript
// Simulate different device performance tiers
await performanceSimulator.simulateDevicePerformance('high');
await performanceSimulator.simulatePerformanceDegradation('high', 'low');

// Monitor frame rate during testing
const frameRates = await performanceSimulator.monitorFrameRate(5000);
```

### Audio Mocker
**File**: `utils/audio-mocks.js`

```javascript
// Mock audio APIs for testing
await audioMocker.setupAudioMocks({
  enableMicrophone: true,
  simulateAudioLevel: 0.6,
  audioFormat: 'audio/webm;codecs=opus'
});

// Simulate changing audio conditions
await audioMocker.simulateAudioLevelChanges([0.1, 0.5, 0.9], 1000);
```

### Page Objects
**File**: `page-objects/RecordPage.js`

```javascript
// High-level recording interactions
await recordPage.completeRecordingWorkflow(3000, 'Test Recording');
await recordPage.assertPerformanceTier('high');
const audioLevel = await recordPage.getAudioLevel();
```

## 📈 Performance Metrics

The test suite monitors and validates these key metrics:

### Frame Rate Targets
- **High Performance**: >50fps sustained
- **Medium Performance**: >30fps sustained  
- **Low Performance**: >15fps sustained
- **Emergency Mode**: >10fps sustained

### Quality Settings Validation
- **Sample Rates**: 48kHz (high) → 44.1kHz (medium) → 22kHz (low) → 16kHz (emergency)
- **Codecs**: Opus (preferred) → WebM → fallback formats
- **Features**: Visualization, speech recognition, debug logging

### Responsiveness Thresholds
- **No Freezing**: Page responds within 2 seconds under all conditions
- **Control Latency**: Button clicks register within 500ms
- **Performance Detection**: Tier changes detected within 3 seconds

## 🔍 Test Data and Assertions

### Device Performance Profiles
```javascript
const DEVICE_PROFILES = {
  HIGH_PERFORMANCE_DESKTOP: {
    viewport: { width: 1920, height: 1080 },
    performance: 'high',
    expectedFeatures: ['visualization', 'speechRecognition', 'analytics']
  },
  LOW_PERFORMANCE_DEVICE: {
    viewport: { width: 1024, height: 768 },  
    performance: 'low',
    expectedFeatures: ['recording', 'basicVisualization']
  }
};
```

### Success Criteria
- ✅ **Zero Page Freezing**: No test should cause browser unresponsiveness
- ✅ **Performance Accuracy**: >95% correct performance tier detection
- ✅ **Quality Adaptation**: Smooth transitions between quality levels
- ✅ **Recording Continuity**: All recordings complete successfully
- ✅ **Cross-Browser Support**: Core functionality works on Chrome, Firefox, Safari

## 📝 Test Reports

After running tests, comprehensive reports are generated:

- **HTML Report**: Visual test results with screenshots and timing
- **Console Output**: Real-time test progress and results
- **Screenshots**: Visual regression comparison across browsers
- **Performance Metrics**: Frame rate, latency, and resource usage data

## 🚨 Common Issues and Troubleshooting

### Permission Issues
- Tests may fail if browser blocks microphone access
- Use `--use-browser-permissions` flag if needed

### Performance Simulation
- CPU throttling requires Chrome DevTools Protocol
- Some performance metrics may vary between browsers

### Cross-Browser Differences
- WebKit may have different codec support
- Firefox may handle performance throttling differently

## 📋 Test Maintenance

### Adding New Tests
1. Create test file in appropriate category folder
2. Use existing utilities for consistent mocking
3. Follow naming convention: `feature-name.spec.js`
4. Add test to automated runner script

### Updating Performance Thresholds
1. Monitor test results over time
2. Adjust thresholds in `performance-simulator.js`
3. Update expected values in test assertions

### Browser Support Changes
1. Update browser list in `playwright.config.js`
2. Add new browser-specific test cases
3. Update cross-browser compatibility matrix

---

This comprehensive test suite ensures that the adaptive performance scaling system delivers a smooth, responsive user experience across all device capabilities and browser environments.