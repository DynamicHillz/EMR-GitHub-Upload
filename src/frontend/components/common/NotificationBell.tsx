import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShieldAlert } from 'lucide-react';

type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface Notification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  acknowledgedAt?: string | null;
  createdAt: string;
}

const getApiBaseUrl = () => import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

// Left-border treatment per severity — deliberately not a full reorder of
// the list (chronological order stays predictable), just a scannable cue.
const SEVERITY_BORDER: Record<NotificationSeverity, string> = {
  CRITICAL: 'border-l-4 border-red-500',
  WARNING: 'border-l-4 border-amber-400',
  INFO: 'border-l-4 border-gray-200',
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [needsAckCount, setNeedsAckCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchUnreadCount = async () => {
    try {
      const [unreadRes, ackRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/notifications/unread-count`, { headers: authHeaders() }),
        fetch(`${getApiBaseUrl()}/api/notifications/unread-count?needsAcknowledgment=true`, { headers: authHeaders() }),
      ]);
      if (unreadRes.ok) setUnreadCount((await unreadRes.json()).count || 0);
      if (ackRes.ok) setNeedsAckCount((await ackRes.json()).count || 0);
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/notifications?limit=15`, { headers: authHeaders() });
      if (res.ok) {
        const result = await res.json();
        setNotifications(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) fetchNotifications();
    setIsOpen((prev) => !prev);
  };

  const navigateForNotification = (notification: Notification) => {
    if (notification.type === 'STOCK_ALERT') {
      navigate('/pharmacy');
    } else if (notification.type === 'CRITICAL_LAB_RESULT' || notification.type === 'LAB_RESULT_READY') {
      navigate('/lab');
    } else if (notification.type === 'MEDICATION_CHANGE' && notification.entityId) {
      // entityId is the admissionId for this type (see inpatient.service.ts's
      // addWardRound) — unlike CRITICAL_VITAL_SIGN, whose entityId points at
      // the VitalChart record itself, not the admission.
      navigate(`/inpatient/${notification.entityId}`);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await fetch(`${getApiBaseUrl()}/api/notifications/${notification.id}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - (notification.isRead ? 0 : 1)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    setIsOpen(false);
    navigateForNotification(notification);
  };

  // Distinct from mark-read — confirms a clinician is acting on a CRITICAL
  // alert. Stops the row's persistent "needs attention" highlight.
  const handleAcknowledge = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    try {
      await fetch(`${getApiBaseUrl()}/api/notifications/${notification.id}/acknowledge`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, acknowledgedAt: now, isRead: true } : n)));
      setNeedsAckCount((prev) => Math.max(0, prev - 1));
      setUnreadCount((prev) => Math.max(0, prev - (notification.isRead ? 0 : 1)));
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${getApiBaseUrl()}/api/notifications/read-all`, { method: 'PATCH', headers: authHeaders() });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button onClick={handleToggle} className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {needsAckCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No notifications yet.</p>
          ) : (
            notifications.map((notification) => {
              const needsAck = notification.severity === 'CRITICAL' && !notification.acknowledgedAt;
              return (
                <div
                  key={notification.id}
                  className={`border-b border-gray-50 last:border-b-0 ${SEVERITY_BORDER[notification.severity] || SEVERITY_BORDER.INFO} ${
                    needsAck ? 'bg-red-50' : !notification.isRead ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <button onClick={() => handleNotificationClick(notification)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start gap-2">
                      {!notification.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />}
                      <div className={notification.isRead ? 'ml-3.5' : ''}>
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{notification.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                  {needsAck && (
                    <div className="px-4 pb-3 -mt-1">
                      <button
                        onClick={(e) => handleAcknowledge(e, notification)}
                        className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-md"
                      >
                        Acknowledge
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
