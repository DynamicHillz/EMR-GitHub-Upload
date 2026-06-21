/**
 * ErrorAlert Component
 *
 * Displays user-friendly error messages with consistent styling
 */

import React from 'react';
import { AlertCircle, XCircle, AlertTriangle } from 'lucide-react';

export interface ErrorAlertProps {
  /** The error message to display */
  message: string;
  /** Optional title for the error */
  title?: string;
  /** Error severity level */
  severity?: 'error' | 'warning' | 'info';
  /** Whether to show a retry button */
  onRetry?: () => void;
  /** Whether to show a dismiss button */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  title,
  severity = 'error',
  onRetry,
  onDismiss,
  className = '',
}) => {
  // Determine colors based on severity
  const severityStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
      Icon: XCircle,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
      Icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      Icon: AlertCircle,
    },
  };

  const styles = severityStyles[severity];
  const Icon = styles.Icon;

  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.icon}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.text} mb-1`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${styles.text}`}>{message}</p>

          {(onRetry || onDismiss) && (
            <div className="mt-3 flex gap-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`text-sm font-medium ${styles.text} hover:underline focus:outline-none focus:underline`}
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`text-sm font-medium ${styles.text} hover:underline focus:outline-none focus:underline`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorAlert;
