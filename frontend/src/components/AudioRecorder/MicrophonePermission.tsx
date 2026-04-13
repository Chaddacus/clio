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
        return <CheckCircleIcon className="w-5 h-5 text-secondary" />;
      case 'denied':
        return <NoSymbolIcon className="w-5 h-5 text-error" />;
      case 'checking':
        return <div className="w-5 h-5 animate-spin rounded-full border-2 border-outline-variant border-t-primary"></div>;
      default:
        return <MicrophoneIcon className="w-5 h-5 text-on-surface-variant" />;
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
    <div className={`bg-surface-container-low rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {getPermissionIcon()}
        <div className="flex-1">
          <h3 className={`font-medium ${
            message.type === 'success' ? 'text-secondary' :
            message.type === 'error' ? 'text-error' :
            'text-on-surface'
          }`}>
            {message.title}
          </h3>
          <p className={`text-sm mt-1 ${
            message.type === 'success' ? 'text-secondary/80' :
            message.type === 'error' ? 'text-error/80' :
            'text-on-surface-variant'
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
                  className="text-sm text-primary hover:text-primary-container w-fit"
                >
                  Need help?
                </button>
              )}
            </div>
          )}

          {showHelp && (
            <div className="mt-3 p-3 bg-surface-container-high rounded-lg">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-on-surface mb-2">
                    How to allow microphone access:
                  </p>
                  <ul className="space-y-1 text-on-surface-variant list-disc list-inside">
                    <li>Look for the microphone icon in your browser's address bar</li>
                    <li>Click the icon and select "Allow" for microphone access</li>
                    <li>If blocked, click the settings icon and change microphone to "Allow"</li>
                    <li>Refresh the page if needed after changing permissions</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="btn-primary text-xs px-2 py-1"
                    >
                      Refresh page
                    </button>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="text-xs text-primary hover:text-primary-container"
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