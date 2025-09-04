import { useState } from 'react';
import { useStore } from '../lib/store';
import {
  CogIcon,
  SunIcon,
  MoonIcon,
  ServerIcon,
  WifiIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface HeaderProps {
  connected: boolean;
}

export default function Header({ connected }: HeaderProps) {
  const { darkMode, toggleDarkMode, metrics } = useStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Logo and Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
          <ServerIcon className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          AI Ubuntu Agent
        </h1>
      </div>

      {/* Center Status */}
      <div className="flex items-center space-x-6">
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <WifiIcon
            className={`w-4 h-4 ${
              connected ? 'text-green-500' : 'text-red-500'
            }`}
          />
          <span
            className={`text-sm ${
              connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Tasks: {metrics.tasksActive}/{metrics.tasksTotal}</span>
            <span>Approvals: {metrics.approvalsPending}</span>
            <span>Connections: {metrics.connectionsActive}</span>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <SunIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <MoonIcon className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Settings"
        >
          <CogIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={import.meta.env.VITE_AGENT_URL || 'http://localhost:9991'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Desktop URL
                </label>
                <input
                  type="text"
                  value={import.meta.env.VITE_DESKTOP_URL || 'http://localhost:6080'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  readOnly
                />
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version: 1.0.0
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
