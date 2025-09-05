import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { UserCircleIcon, CpuChipIcon } from '@heroicons/react/24/solid';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: any[];
}

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
}

export default function MessageList({ messages, isTyping }: MessageListProps) {
  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          } animate-fade-in`}
        >
          <div
            className={`flex max-w-[80%] ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            } space-x-2`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {message.role === 'user' ? (
                <UserCircleIcon className="w-8 h-8 text-gray-400" />
              ) : (
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            
            {/* Message Content */}
            <div
              className={`px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : message.role === 'system'
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
              
              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-semibold mb-1">Tools Used:</p>
                  {message.toolCalls.map((tool: any, index: number) => (
                    <div
                      key={index}
                      className="text-xs bg-gray-200 dark:bg-gray-600 rounded px-2 py-1 mt-1"
                    >
                      <span className="font-mono">{tool.name}</span>
                      {tool.arguments && (
                        <pre className="text-xs mt-1 whitespace-pre-wrap">
                          {JSON.stringify(tool.arguments, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Timestamp */}
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp ? format(new Date(message.timestamp), 'HH:mm:ss') : 'now'}
              </p>
            </div>
          </div>
        </div>
      ))}
      
      {/* Typing Indicator */}
      {isTyping && (
        <div className="flex justify-start animate-fade-in">
          <div className="flex space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <CpuChipIcon className="w-5 h-5 text-white" />
            </div>
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
