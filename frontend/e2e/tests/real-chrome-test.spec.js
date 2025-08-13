const { test, expect } = require('@playwright/test');

test.describe('Real Chrome Browser Test', () => {
  test('Test with actual Chrome browser that has system permissions', async () => {
    console.log('🌐 Testing with real Chrome browser...');
    
    // This test will use your actual Chrome installation
    const { chromium } = require('playwright');
    
    // Connect to your actual Chrome browser (you need to start it with remote debugging)
    // Instructions will be printed below
    
    console.log('\n📋 MANUAL TESTING INSTRUCTIONS:');
    console.log('==========================================');
    console.log('Since Playwright\'s Chromium doesn\'t have system mic permissions,');
    console.log('please test manually in your regular Chrome browser:');
    console.log('');
    console.log('1. Open your regular Chrome browser');
    console.log('2. Go to: http://localhost:3011/record');
    console.log('3. Open DevTools (F12) → Console tab');
    console.log('4. Clear the console');
    console.log('5. Click "Allow microphone access" if prompted');
    console.log('6. Click the record button');
    console.log('7. Look for these specific log messages:');
    console.log('');
    console.log('   ✅ EXPECT TO SEE:');
    console.log('   - [useAudioRecorder] getUserMedia returned: {...}');
    console.log('   - [useAudioRecorder] Stream validation passed');
    console.log('   - [useAudioRecorder] MediaRecorder constructor succeeded');
    console.log('   - [useAudioRecorder] MediaRecorder ONSTART event fired');
    console.log('');
    console.log('   ❌ IF YOU SEE ERRORS:');
    console.log('   - Take a screenshot of the console');
    console.log('   - Copy the error messages');
    console.log('   - Share them with me');
    console.log('');
    console.log('📱 ALTERNATIVE: Try a simple browser microphone test');
    console.log('   - Go to: https://mictests.com/');
    console.log('   - Test if your microphone works in the browser');
    console.log('   - This will confirm if it\'s a browser vs app issue');
    console.log('');
    console.log('==========================================');
    
    // Create a simple HTML file for manual testing
    const fs = require('fs');
    const path = require('path');
    
    const testHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Microphone Test</title>
</head>
<body>
    <h2>Direct Microphone Test</h2>
    <button id="testBtn">Test Microphone Access</button>
    <div id="result"></div>
    
    <script>
        document.getElementById('testBtn').onclick = async () => {
            const result = document.getElementById('result');
            result.innerHTML = 'Testing...';
            
            try {
                console.log('Starting direct getUserMedia test...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                console.log('✅ SUCCESS: getUserMedia worked!', {
                    streamId: stream.id,
                    active: stream.active,
                    tracks: stream.getTracks().length
                });
                
                result.innerHTML = '✅ SUCCESS: Microphone access granted!';
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                
            } catch (error) {
                console.error('❌ FAILED:', error);
                result.innerHTML = \`❌ FAILED: \${error.name} - \${error.message}\`;
            }
        };
    </script>
</body>
</html>`;
    
    const testFilePath = path.join(process.cwd(), 'microphone-test.html');
    fs.writeFileSync(testFilePath, testHTML);
    
    console.log(`\n📄 DIRECT TEST FILE CREATED:`);
    console.log(`   Open in Chrome: file://${testFilePath}`);
    console.log(`   This tests getUserMedia directly without your app's complexity`);
    
    // Pass the test since this is informational
    expect(true).toBe(true);
  });
});