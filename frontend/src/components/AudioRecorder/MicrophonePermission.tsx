import React, { useState, useEffect } from 'react';
import { 
  MicrophoneIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt' | 'checking';

interface MicrophonePermissionProps {
  onPermissionChange: (granted: boolean) => void;
  onRequestPermission: () => Promise<boolean>;
  className?: string;
}

const MicrophonePermission: React.FC<MicrophonePermissionProps> = ({
  onPermissionChange,
  onRequestPermission,
  className = ''
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    setPermissionState('checking');
    
    try {
      // First try the Permissions API if available
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ 
          name: 'microphone' as PermissionName 
        });
        
        const state = permissionStatus.state as PermissionState;
        setPermissionState(state);
        onPermissionChange(state === 'granted');
        
        // Listen for permission changes
        permissionStatus.onchange = () => {
          const newState = permissionStatus.state as PermissionState;
          setPermissionState(newState);
          onPermissionChange(newState === 'granted');
        };
      } else {
        // Fallback: assume we need to prompt
        setPermissionState('prompt');
        onPermissionChange(false);
      }
    } catch (_error) {
      setPermissionState('prompt');
      onPermissionChange(false);
    }
  };

  const requestPermission = async () => {
    setIsRequesting(true);
    setShowHelp(false);
    
    try {
      const granted = await onRequestPermission();
      
      if (granted) {
        setPermissionState('granted');
        onPermissionChange(true);
      } else {
        setPermissionState('denied');
        onPermissionChange(false);
        setShowHelp(true);
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setPermissionState('denied');
      onPermissionChange(false);
      setShowHelp(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const getPermissionIcon = () => {
    switch (permissionState) {
      case 'granted':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'denied':
        return <NoSymbolIcon className="w-5 h-5 text-red-600" />;
      case 'checking':
        return <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-blue-600"></div>;
      default:
        return <MicrophoneIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPermissionMessage = () => {
    switch (permissionState) {
      case 'granted':
        return {
          title: 'Microphone access granted',
          message: 'You can start recording voice notes.',
          type: 'success' as const
        };
      case 'denied':
        return {
          title: 'Microphone access denied',
          message: 'Please allow microphone access to record voice notes.',
          type: 'error' as const
        };
      case 'checking':
        return {
          title: 'Checking permissions...',
          message: 'Verifying microphone access.',
          type: 'info' as const
        };
      case 'prompt':
      default:
        return {
          title: 'Microphone access required',
          message: 'Click below to allow microphone access for voice recording.',
          type: 'info' as const
        };
    }
  };

  const message = getPermissionMessage();

  if (permissionState === 'granted') {
    return null; // Don't show anything when permission is granted
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {getPermissionIcon()}
        <div className="flex-1">
          <h3 className={`font-medium ${
            message.type === 'success' ? 'text-green-900 dark:text-green-100' :
            message.type === 'error' ? 'text-red-900 dark:text-red-100' :
            'text-gray-900 dark:text-gray-100'
          }`}>
            {message.title}
          </h3>
          <p className={`text-sm mt-1 ${
            message.type === 'success' ? 'text-green-700 dark:text-green-300' :
            message.type === 'error' ? 'text-red-700 dark:text-red-300' :
            'text-gray-600 dark:text-gray-400'
          }`}>
            {message.message}
          </p>

          {(permissionState === 'prompt' || permissionState === 'denied') && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={requestPermission}
                disabled={isRequesting}
                className="btn-primary text-sm py-2 px-4 w-fit"
              >
                {isRequesting ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white mr-2"></div>
                    Requesting access...
                  </>
                ) : (
                  <>
                    <MicrophoneIcon className="w-4 h-4 mr-2" />
                    Allow microphone access
                  </>
                )}
              </button>

              {!showHelp && permissionState === 'denied' && (
                <button
                  onClick={() => setShowHelp(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 w-fit"
                >
                  Need help?
                </button>
              )}
            </div>
          )}

          {showHelp && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    How to allow microphone access:
                  </p>
                  <ul className="space-y-1 text-blue-800 dark:text-blue-200 list-disc list-inside">
                    <li>Look for the microphone icon in your browser's address bar</li>
                    <li>Click the icon and select "Allow" for microphone access</li>
                    <li>If blocked, click the settings icon and change microphone to "Allow"</li>
                    <li>Refresh the page if needed after changing permissions</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Refresh page
                    </button>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Close help
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicrophonePermission;