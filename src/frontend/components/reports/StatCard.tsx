import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple';
}

const COLOR_CLASSES: Record<StatCardProps['color'], { text: string; bg: string; icon: string }> = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-100', icon: 'text-blue-600' },
  green: { text: 'text-green-600', bg: 'bg-green-100', icon: 'text-green-600' },
  red: { text: 'text-red-600', bg: 'bg-red-100', icon: 'text-red-600' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-100', icon: 'text-orange-600' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-100', icon: 'text-purple-600' },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => {
  const classes = COLOR_CLASSES[color];
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`text-2xl font-bold mt-2 ${classes.text}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full ${classes.bg}`}>
          <Icon className={`w-8 h-8 ${classes.icon}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
