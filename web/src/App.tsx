import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './lib/store';
import Chat from './components/Chat/Chat';
import DesktopViewer from './components/Desktop/Viewer';
import TaskList from './components/Tasks/TaskList';
import ApprovalPanel from './components/ApprovalPanel';
import Header from './components/Header';
import { SettingsPanel } from './components/Settings';
import { connectWebSocket } from './lib/websocket';

function App() {
  const [connected, setConnected] = useState(false);
  const { initializeApp, darkMode } = useStore();

  useEffect(() => {
    // Initialize the app
    initializeApp();

    // Connect to WebSocket
    const cleanup = connectWebSocket(
      () => setConnected(true),
      () => setConnected(false)
    );

    return cleanup;
  }, [initializeApp]);

  useEffect(() => {
    // Apply dark mode class
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? '#374151' : '#fff',
            color: darkMode ? '#fff' : '#111827',
          },
        }}
      />

      {/* Header */}
      <Header connected={connected} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Chat */}
        <div className="w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
          <Chat />
        </div>

        {/* Center - Desktop Viewer */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <DesktopViewer />
          </div>

          {/* Approval Panel */}
          <ApprovalPanel />
        </div>

        {/* Right Sidebar - Tasks */}
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <TaskList />
        </div>
      </div>

      {/* Settings Button */}
      <SettingsPanel />
    </div>
  );
}

export default App;
