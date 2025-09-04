import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  CameraIcon,
  CommandLineIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { sendDesktopKey, requestScreenshot } from '../../lib/websocket';
import toast from 'react-hot-toast';

interface ControlsProps {
  onToggleView: () => void;
  showScreenshot: boolean;
}

export default function Controls({ onToggleView, showScreenshot }: ControlsProps) {
  const handleKey = (keys: string | string[]) => {
    sendDesktopKey(keys);
    toast.success(`Sent key: ${Array.isArray(keys) ? keys.join('+') : keys}`);
  };

  const handleScreenshot = () => {
    requestScreenshot();
    toast.success('Screenshot captured');
  };

  const handleCopy = () => {
    handleKey(['ctrl', 'c']);
  };

  const handlePaste = () => {
    handleKey(['ctrl', 'v']);
  };

  const handleTerminal = () => {
    handleKey(['ctrl', 'alt', 't']);
  };

  const handleFullscreen = () => {
    const elem = document.querySelector('.vnc-viewer') as HTMLElement;
    if (elem?.requestFullscreen) {
      elem.requestFullscreen();
    }
  };

  return (
    <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        {/* Left Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleView}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={showScreenshot ? 'Switch to Live View' : 'Switch to Screenshot Mode'}
          >
            {showScreenshot ? (
              <PlayIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <PauseIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          
          <button
            onClick={handleScreenshot}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Take Screenshot"
          >
            <CameraIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          
          {/* Common Shortcuts */}
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            title="Copy (Ctrl+C)"
          >
            Copy
          </button>
          
          <button
            onClick={handlePaste}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            title="Paste (Ctrl+V)"
          >
            Paste
          </button>
          
          <button
            onClick={() => handleKey('escape')}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            title="Escape"
          >
            ESC
          </button>
          
          <button
            onClick={() => handleKey('tab')}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            title="Tab"
          >
            TAB
          </button>
          
          <button
            onClick={() => handleKey('enter')}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            title="Enter"
          >
            Enter
          </button>
        </div>
        
        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTerminal}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Open Terminal (Ctrl+Alt+T)"
          >
            <CommandLineIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          {!showScreenshot && (
            <button
              onClick={handleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Fullscreen"
            >
              <ArrowsPointingOutIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh Connection"
          >
            <ArrowPathIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Function Keys Row */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">F-Keys:</span>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
          <button
            key={num}
            onClick={() => handleKey(`f${num}`)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          >
            F{num}
          </button>
        ))}
      </div>
    </div>
  );
}
