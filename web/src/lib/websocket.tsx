import io, { Socket } from 'socket.io-client';
import { useStore } from './store';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export function connectWebSocket(
  onConnect?: () => void,
  onDisconnect?: () => void
): () => void {
  const store = useStore.getState();
  const { token } = store;
  
  // Connect to WebSocket server
  socket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:3002', {
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
  });
  
  // Connection events
  socket.on('connect', () => {
    console.log('WebSocket connected:', socket?.id);
    store.setWsConnected(true);
    onConnect?.();
    toast.success('Connected to server');
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
    store.setWsConnected(false);
    onDisconnect?.();
    toast.error('Disconnected from server');
  });
  
  socket.on('error', (error: any) => {
    console.error('WebSocket error:', error);
    toast.error(`Connection error: ${error.message}`);
  });
  
  // Task events
  socket.on('task:created', (task) => {
    store.addTask(task);
  });
  
  socket.on('task:started', (task) => {
    store.updateTask(task.id, { status: 'running' });
  });
  
  socket.on('task:step', ({ task, step }) => {
    store.updateTask(task.id, {
      steps: [...(task.steps || []), step],
    });
  });
  
  socket.on('task:completed', (task) => {
    store.updateTask(task.id, {
      status: 'completed',
      completedAt: task.completedAt,
      result: task.result,
    });
    toast.success(`Task completed: ${task.instruction.substring(0, 50)}...`);
  });
  
  socket.on('task:failed', (task) => {
    store.updateTask(task.id, {
      status: 'failed',
      completedAt: task.completedAt,
      error: task.error,
    });
    toast.error(`Task failed: ${task.error}`);
  });
  
  // Approval events
  socket.on('action:pending', (approval) => {
    store.addApproval(approval);
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-slide-up' : 'animate-slide-down'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Action Approval Required
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Tool: {approval.tool}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Risk: {approval.riskLevel}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              approveAction(approval.id);
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-green-600 hover:text-green-500 focus:outline-none"
          >
            Approve
          </button>
        </div>
      </div>
    ), {
      duration: 30000, // 30 second timeout
      position: 'top-right',
    });
  });
  
  socket.on('action:approved', ({ approvalId }) => {
    store.removeApproval(approvalId);
  });
  
  socket.on('action:denied', ({ approvalId }) => {
    store.removeApproval(approvalId);
  });
  
  // Chat events
  socket.on('chat:message', (message) => {
    store.addMessage(message);
    store.setIsTyping(false);
  });
  
  socket.on('chat:start', () => {
    store.setIsTyping(true);
  });
  
  socket.on('chat:end', () => {
    store.setIsTyping(false);
  });
  
  socket.on('chat:error', ({ error }) => {
    store.setIsTyping(false);
    toast.error(`Chat error: ${error}`);
  });
  
  // Desktop events
  socket.on('desktop:screenshot', (data) => {
    store.setDesktopScreenshot(data.image);
  });
  
  // Metrics events
  socket.on('metrics:update', (metrics) => {
    store.setMetrics(metrics);
  });
  
  // Return cleanup function
  return () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };
}

// WebSocket API functions
export function sendMessage(message: string, context?: string[], tools?: string[]) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('chat:message', { message, context, tools });
}

export function startTask(instruction: string, context?: any, constraints?: string[], timeout?: number) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('task:start', { instruction, context, constraints, timeout });
}

export function subscribeToTask(taskId: string) {
  if (!socket?.connected) return;
  socket.emit('task:subscribe', taskId);
}

export function unsubscribeFromTask(taskId: string) {
  if (!socket?.connected) return;
  socket.emit('task:unsubscribe', taskId);
}

export function approveAction(actionId: string) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('action:approve', { actionId });
}

export function denyAction(actionId: string, reason?: string) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('action:deny', { actionId, reason });
}

export function requestScreenshot() {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('desktop:screenshot');
}

export function sendDesktopClick(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left', double: boolean = false) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('desktop:click', { x, y, button, double });
}

export function sendDesktopType(text: string, delay: number = 50) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('desktop:type', { text, delay });
}

export function sendDesktopKey(keys: string | string[]) {
  if (!socket?.connected) {
    toast.error('Not connected to server');
    return;
  }
  
  socket.emit('desktop:key', { keys });
}

export function requestMetrics() {
  if (!socket?.connected) return;
  socket.emit('metrics:get');
}


