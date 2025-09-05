import { useRef, useEffect, useState } from 'react';
import Controls from './Controls';
import { requestScreenshot } from '../../lib/websocket';
import { useStore } from '../../lib/store';

export default function DesktopViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const { desktopScreenshot } = useStore();
  
  const desktopUrl = import.meta.env.VITE_DESKTOP_URL || 'http://localhost:3000';

  useEffect(() => {
    // Request initial screenshot
    requestScreenshot();
    
    // Request screenshots periodically when in screenshot mode
    const interval = setInterval(() => {
      if (showScreenshot) {
        requestScreenshot();
      }
    }, 2000); // Every 2 seconds
    
    return () => clearInterval(interval);
  }, [showScreenshot]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const toggleView = () => {
    setShowScreenshot(!showScreenshot);
    if (!showScreenshot) {
      requestScreenshot();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Desktop Controls */}
      <Controls onToggleView={toggleView} showScreenshot={showScreenshot} />
      
      {/* Desktop Display */}
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
        {isLoading && !showScreenshot && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="spinner"></div>
              <p className="mt-4 text-gray-400">Connecting to desktop...</p>
            </div>
          </div>
        )}
        
        {showScreenshot ? (
          <div className="w-full h-full flex items-center justify-center">
            {desktopScreenshot ? (
              <img
                src={`data:image/png;base64,${desktopScreenshot}`}
                alt="Desktop Screenshot"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="spinner"></div>
                <p className="mt-4 text-gray-400">Waiting for screenshot...</p>
              </div>
            )}
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={desktopUrl}
            className="w-full h-full vnc-viewer"
            onLoad={handleIframeLoad}
            allow="clipboard-read; clipboard-write"
            title="Desktop Viewer"
          />
        )}
        
        {/* Connection Info Overlay */}
        {!isLoading && (
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded-lg">
            <p className="text-xs text-gray-300">
              {showScreenshot ? 'Screenshot Mode' : 'Live VNC Connection'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
