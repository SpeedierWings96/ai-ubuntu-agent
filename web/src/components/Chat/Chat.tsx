import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { sendMessage } from '../../lib/websocket';
import MessageList from './MessageList';
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, isTyping, addMessage, clearMessages } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message to store
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    // Add a system message indicating task execution
    const systemMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant' as const,
      content: `🤖 Executing: "${input}"...`,
      timestamp: Date.now() + 1,
    };
    addMessage(systemMessage);

    // Send message via WebSocket (this now creates a task)
    sendMessage(input);

    // Clear input
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chat</h2>
        <button
          onClick={clearMessages}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Clear chat"
        >
          <TrashIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">Ready to execute commands</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Type a command like "Open a terminal" or "Take a screenshot"
              </p>
              <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                <p>Examples:</p>
                <p className="mt-1">• "List all files in the home directory"</p>
                <p>• "Open Firefox and go to google.com"</p>
                <p>• "Show system information"</p>
                <p>• "Create a text file on the desktop"</p>
              </div>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isTyping={isTyping} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command for the AI to execute..."
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Quick Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setInput('Take a screenshot of the desktop')}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Screenshot
          </button>
          <button
            onClick={() => setInput('Open a terminal')}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Open Terminal
          </button>
          <button
            onClick={() => setInput('Show system information')}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            System Info
          </button>
          <button
            onClick={() => setInput('List running processes')}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            List Processes
          </button>
        </div>
      </div>
    </div>
  );
}
