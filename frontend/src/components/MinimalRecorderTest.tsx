import React from 'react';
import { useMinimalRecorder } from '../hooks/useMinimalRecorder';

const MinimalRecorderTest: React.FC = () => {
  const recorder = useMinimalRecorder();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">🎤 Minimal Recorder Test</h2>
      
      <p className="text-gray-600 mb-6">
        Testing MediaRecorder with minimal implementation to isolate the recording duration issue.
      </p>

      {/* Status Display */}
      <div className={`p-4 rounded-lg mb-4 ${
        recorder.isRecording 
          ? 'bg-red-100 border-2 border-red-300 text-red-800' 
          : 'bg-green-100 border-2 border-green-300 text-green-800'
      }`}>
        <div className="flex justify-between items-center">
          <span className="font-semibold">
            Status: {recorder.isRecording ? '🔴 Recording' : '⭕ Ready'}
          </span>
          <span className="text-xl font-mono">
            {recorder.formatTime(recorder.recordingTime)}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {recorder.error && (
        <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded-lg mb-4">
          <strong>Error:</strong> {recorder.error}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={recorder.startRecording}
          disabled={recorder.isRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            recorder.isRecording
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
          }`}
        >
          🎤 Start Recording
        </button>
        
        <button
          onClick={recorder.stopRecording}
          disabled={!recorder.isRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            !recorder.isRecording
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
          }`}
        >
          ⏹️ Stop Recording
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">🎯 Test Instructions:</h3>
        <ol className="list-decimal list-inside text-blue-700 space-y-1 text-sm">
          <li>Open your browser's Developer Console (F12)</li>
          <li>Click "Start Recording" and grant microphone permission</li>
          <li>Let it record for at least 10 seconds</li>
          <li>Watch the console logs for detailed timing information</li>
          <li>If recording stops before you click "Stop", the issue is reproduced</li>
          <li>If recording continues normally, the issue is in the complex implementation</li>
        </ol>
      </div>

      {/* Analysis */}
      <div className="mt-4 bg-yellow-50 border border-yellow-300 p-4 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">📊 Expected Results:</h3>
        <div className="text-yellow-700 text-sm">
          {recorder.recordingTime === 0 ? (
            <p>Ready to test - recording timer will appear when started</p>
          ) : recorder.recordingTime < 3 && recorder.error ? (
            <p>❌ <strong>Issue reproduced!</strong> Recording stopped after {recorder.recordingTime} seconds - this confirms the problem exists at the MediaRecorder level.</p>
          ) : recorder.recordingTime >= 10 ? (
            <p>✅ <strong>Success!</strong> Recording has continued for {recorder.recordingTime} seconds - the basic MediaRecorder is working correctly.</p>
          ) : (
            <p>🔄 <strong>Testing...</strong> Recording for {recorder.recordingTime} seconds so far - let it run longer to confirm stability.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinimalRecorderTest;