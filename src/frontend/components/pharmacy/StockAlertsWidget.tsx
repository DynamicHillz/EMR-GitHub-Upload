/**
 * Stock Alerts Widget
 *
 * REQ-PHARM-5: Display stock alerts for low inventory and near-expiry medications
 */

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, TrendingDown, Calendar, X } from 'lucide-react';

interface StockAlert {
  id: string;
  medicationName: string;
  alertType: string;
  severity: string;
  message: string;
  batchNumber?: string;
  daysUntilExpiry?: number;
  currentStock?: number;
  threshold?: number;
  createdAt: string;
}

interface StockAlertsWidgetProps {
  onAlertClick?: (alert: StockAlert) => void;
}

const StockAlertsWidget: React.FC<StockAlertsWidgetProps> = ({ onAlertClick }) => {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchAlerts();
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/pharmacy/alerts?status=ACTIVE', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setAlerts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/pharmacy/alerts/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error generating alerts:', error);
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'OUT_OF_STOCK':
      case 'LOW_STOCK':
        return <TrendingDown className="w-5 h-5" />;
      case 'NEAR_EXPIRY':
      case 'EXPIRED':
        return <Calendar className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'WARNING':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const warningAlerts = alerts.filter(a => a.severity === 'WARNING');

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div
        className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-semibold">Stock Alerts</h3>
            <p className="text-sm text-gray-600">
              {criticalAlerts.length} critical, {warningAlerts.length} warnings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateAlerts();
            }}
            className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
          >
            Scan Now
          </button>
          <button className="p-1">
            {isExpanded ? <X className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No active alerts. All inventory levels are good!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border-l-4 ${getSeverityClass(alert.severity)} cursor-pointer hover:bg-gray-50`}
                  onClick={() => onAlertClick?.(alert)}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.alertType)}
                    <div className="flex-1">
                      <p className="font-medium">{alert.medicationName}</p>
                      <p className="text-sm mt-1">{alert.message}</p>
                      {alert.batchNumber && (
                        <p className="text-xs mt-1 opacity-75">
                          Batch: {alert.batchNumber}
                        </p>
                      )}
                      <p className="text-xs mt-1 opacity-75">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      alert.severity === 'WARNING' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockAlertsWidget;
