import { useState } from 'react';
import { useStore } from '../../lib/store';
import { startTask, subscribeToTask } from '../../lib/websocket';
import { format } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function TaskList() {
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const { tasks, currentTask, setCurrentTask } = useStore();

  const handleCreateTask = () => {
    if (!taskInput.trim()) return;
    
    startTask(taskInput);
    setTaskInput('');
    setShowNewTask(false);
  };

  const handleSelectTask = (task: any) => {
    setCurrentTask(task);
    subscribeToTask(task.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <ClockIcon className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'pending_approval':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'pending_approval':
        return 'Pending Approval';
      case 'queued':
        return 'Queued';
      default:
        return status;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h2>
        <button
          onClick={() => setShowNewTask(true)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="New task"
        >
          <PlusIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* New Task Form */}
      {showNewTask && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe the task..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={3}
            autoFocus
          />
          <div className="mt-2 flex space-x-2">
            <button
              onClick={handleCreateTask}
              disabled={!taskInput.trim()}
              className="px-3 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Task
            </button>
            <button
              onClick={() => {
                setShowNewTask(false);
                setTaskInput('');
              }}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">No tasks yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Create a task for the AI agent to execute
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentTask?.id === task.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {task.instruction}
                    </p>
                    <div className="mt-1 flex items-center space-x-2">
                      {getStatusIcon(task.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getStatusText(task.status)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {format(task.createdAt, 'HH:mm')}
                      </span>
                    </div>
                    {task.steps && task.steps.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {task.steps.length} steps
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Task Details */}
      {currentTask && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Current Task
          </h3>
          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {currentTask.instruction}
            </p>
            <div className="flex items-center space-x-2">
              {getStatusIcon(currentTask.status)}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getStatusText(currentTask.status)}
              </span>
            </div>
            {currentTask.error && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Error: {currentTask.error}
              </p>
            )}
            {currentTask.steps && currentTask.steps.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Recent Steps:
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {currentTask.steps.slice(-3).map((step: any, index: number) => (
                    <div
                      key={index}
                      className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1"
                    >
                      {step.thought && (
                        <p className="text-gray-700 dark:text-gray-300">{step.thought}</p>
                      )}
                      {step.action && (
                        <p className="text-gray-600 dark:text-gray-400 font-mono">
                          → {step.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
