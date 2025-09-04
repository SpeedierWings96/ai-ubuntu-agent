import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: any[];
}

interface Task {
  id: string;
  instruction: string;
  status: 'queued' | 'running' | 'pending_approval' | 'completed' | 'failed';
  steps: any[];
  result?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

interface Approval {
  id: string;
  taskId: string;
  tool: string;
  parameters: any;
  riskLevel: string;
  timestamp: number;
}

interface AppState {
  // UI State
  darkMode: boolean;
  sidebarOpen: boolean;
  
  // Chat State
  messages: Message[];
  isTyping: boolean;
  
  // Task State
  tasks: Task[];
  currentTask: Task | null;
  
  // Approval State
  approvals: Approval[];
  
  // Desktop State
  desktopScreenshot: string | null;
  desktopConnected: boolean;
  
  // WebSocket State
  wsConnected: boolean;
  
  // Auth State
  token: string | null;
  isAuthenticated: boolean;
  
  // Metrics
  metrics: {
    tasksActive: number;
    tasksTotal: number;
    approvalsPending: number;
    connectionsActive: number;
    uptime: number;
    memory: any;
    cpu: any;
  } | null;
  
  // Actions
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  
  // Chat Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setIsTyping: (typing: boolean) => void;
  
  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setCurrentTask: (task: Task | null) => void;
  
  // Approval Actions
  addApproval: (approval: Approval) => void;
  removeApproval: (approvalId: string) => void;
  clearApprovals: () => void;
  
  // Desktop Actions
  setDesktopScreenshot: (screenshot: string | null) => void;
  setDesktopConnected: (connected: boolean) => void;
  
  // WebSocket Actions
  setWsConnected: (connected: boolean) => void;
  
  // Auth Actions
  setToken: (token: string | null) => void;
  logout: () => void;
  
  // Metrics Actions
  setMetrics: (metrics: any) => void;
  
  // App Actions
  initializeApp: () => void;
}

export const useStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial State
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        sidebarOpen: true,
        messages: [],
        isTyping: false,
        tasks: [],
        currentTask: null,
        approvals: [],
        desktopScreenshot: null,
        desktopConnected: false,
        wsConnected: false,
        token: null,
        isAuthenticated: false,
        metrics: null,
        
        // Actions
        toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        
        // Chat Actions
        addMessage: (message) =>
          set((state) => ({
            messages: [...state.messages, message],
          })),
        clearMessages: () => set({ messages: [] }),
        setIsTyping: (typing) => set({ isTyping: typing }),
        
        // Task Actions
        addTask: (task) =>
          set((state) => ({
            tasks: [task, ...state.tasks],
          })),
        updateTask: (taskId, updates) =>
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId ? { ...task, ...updates } : task
            ),
          })),
        setCurrentTask: (task) => set({ currentTask: task }),
        
        // Approval Actions
        addApproval: (approval) =>
          set((state) => ({
            approvals: [approval, ...state.approvals],
          })),
        removeApproval: (approvalId) =>
          set((state) => ({
            approvals: state.approvals.filter((a) => a.id !== approvalId),
          })),
        clearApprovals: () => set({ approvals: [] }),
        
        // Desktop Actions
        setDesktopScreenshot: (screenshot) => set({ desktopScreenshot: screenshot }),
        setDesktopConnected: (connected) => set({ desktopConnected: connected }),
        
        // WebSocket Actions
        setWsConnected: (connected) => set({ wsConnected: connected }),
        
        // Auth Actions
        setToken: (token) =>
          set({
            token,
            isAuthenticated: !!token,
          }),
        logout: () =>
          set({
            token: null,
            isAuthenticated: false,
            messages: [],
            tasks: [],
            approvals: [],
          }),
        
        // Metrics Actions
        setMetrics: (metrics) => set({ metrics }),
        
        // App Actions
        initializeApp: () => {
          // Check for saved token
          const savedToken = localStorage.getItem('auth_token');
          if (savedToken) {
            set({ token: savedToken, isAuthenticated: true });
          }
          
          // Listen for system dark mode changes
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            set({ darkMode: e.matches });
          });
        },
      }),
      {
        name: 'ai-agent-storage',
        partialize: (state) => ({
          darkMode: state.darkMode,
          token: state.token,
        }),
      }
    )
  )
);
