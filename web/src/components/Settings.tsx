import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Brain, Zap, AlertCircle } from 'lucide-react';

interface ConfigData {
  hasApiKey: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  authEnabled: boolean;
}

export const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setModel(data.model);
        setMaxTokens(data.maxTokens);
        setTemperature(data.temperature);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      setMessage('Failed to connect to agent');
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:3002/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openRouterApiKey: apiKey || undefined,
          model,
          maxTokens,
          temperature,
        }),
      });

      if (response.ok) {
        setMessage('Configuration saved successfully!');
        setApiKey(''); // Clear API key field for security
        setTimeout(() => setMessage(''), 3000);
        fetchConfig(); // Refresh config
      } else {
        setMessage('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage('Failed to connect to agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Settings"
      >
        <Settings className="w-6 h-6" />
      </button>

      {/* Settings Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {config && (
              <div className="space-y-4">
                {/* API Key Status */}
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">API Key Status:</span>
                    <span className={config.hasApiKey ? 'text-green-500' : 'text-yellow-500'}>
                      {config.hasApiKey ? 'Configured' : 'Not Set'}
                    </span>
                  </div>
                </div>

                {/* API Key Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    OpenRouter API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={config.hasApiKey ? 'Enter new key to update' : 'Enter your API key'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">openrouter.ai</a>
                  </p>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Brain className="inline w-4 h-4 mr-1" />
                    AI Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
                    <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                    <option value="openai/gpt-4o">GPT-4o</option>
                    <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="google/gemini-pro">Gemini Pro</option>
                    <option value="meta-llama/llama-3-70b">Llama 3 70B</option>
                  </select>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    min="100"
                    max="32000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Zap className="inline w-4 h-4 mr-1" />
                    Temperature: {temperature}
                  </label>
                  <input
                    type="range"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Message */}
                {message && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${
                    message.includes('success') 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    <AlertCircle className="w-5 h-5" />
                    {message}
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={saveConfig}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}

            {!config && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                <p>Cannot connect to agent server</p>
                <p className="text-sm">Make sure the agent is running on port 3002</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};