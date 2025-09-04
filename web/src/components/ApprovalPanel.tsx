import { useState } from 'react';
import { useStore } from '../lib/store';
import { approveAction, denyAction } from '../lib/websocket';
import {
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

export default function ApprovalPanel() {
  const [expanded, setExpanded] = useState(true);
  const { approvals, removeApproval } = useStore();

  if (approvals.length === 0) {
    return null;
  }

  const handleApprove = (approvalId: string) => {
    approveAction(approvalId);
    removeApproval(approvalId);
  };

  const handleDeny = (approvalId: string, reason?: string) => {
    denyAction(approvalId, reason);
    removeApproval(approvalId);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'low':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Action Approvals ({approvals.length})
          </h3>
        </div>
        <button className="p-1">
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Approval Items */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 animate-slide-up"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {approval.tool}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRiskColor(
                        approval.riskLevel
                      )}`}
                    >
                      {approval.riskLevel} risk
                    </span>
                  </div>
                  
                  {approval.parameters && Object.keys(approval.parameters).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Parameters:
                      </p>
                      <pre className="text-xs bg-gray-100 dark:bg-gray-700 rounded p-2 overflow-x-auto">
                        {JSON.stringify(approval.parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Task: {approval.taskId.substring(0, 8)}...
                  </p>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Approve"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeny(approval.id, 'User denied')}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    title="Deny"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => {
                    handleApprove(approval.id);
                    // TODO: Add to whitelist
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Always Allow
                </button>
                <button
                  onClick={() => {
                    handleDeny(approval.id, 'Tool blocked');
                    // TODO: Add to blacklist
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Always Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
