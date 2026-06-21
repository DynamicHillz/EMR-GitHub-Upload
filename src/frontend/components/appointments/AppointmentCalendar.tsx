/**
 * Appointment Calendar Component
 *
 * Displays appointments in a calendar view using react-big-calendar
 * Supports day, week, and month views
 */

import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    patientId: string;
    patientNumber?: string;
    doctorId: string;
    doctorName?: string;
    status: string;
    appointmentType: string;
    reason?: string;
  };
}

interface AppointmentCalendarProps {
  appointments: AppointmentEvent[];
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  onSelectEvent?: (event: AppointmentEvent) => void;
  view?: View;
  onViewChange?: (view: View) => void;
  date?: Date;
  onNavigate?: (date: Date) => void;
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onSelectSlot,
  onSelectEvent,
  view = 'week',
  onViewChange,
  date = new Date(),
  onNavigate,
}) => {
  const eventStyleGetter = (event: AppointmentEvent) => {
    const status = event.resource.status;
    let backgroundColor = '#3b82f6';

    switch (status) {
      case 'SCHEDULED':   backgroundColor = '#3b82f6'; break;
      case 'CHECKED_IN':  backgroundColor = '#f59e0b'; break;
      case 'IN_PROGRESS': backgroundColor = '#8b5cf6'; break;
      case 'COMPLETED':   backgroundColor = '#10b981'; break;
      case 'CANCELLED':   backgroundColor = '#ef4444'; break;
      case 'NO_SHOW':     backgroundColor = '#6b7280'; break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: status === 'CANCELLED' || status === 'NO_SHOW' ? 0.6 : 1,
        color: 'white',
        border: 'none',
        display: 'block',
        overflow: 'hidden',
      },
    };
  };

 const components = useMemo(
  () => ({
    event: ({ event }: { event: AppointmentEvent }) => (
      <div style={{ fontSize: '11px', lineHeight: '1.3', overflow: 'hidden', height: '100%', padding: '0 2px' }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: 0.85 }}>
          {event.resource.appointmentType}
        </div>
      </div>
    ),
  }),
  []
);

  return (
    <div className="h-full bg-white rounded-lg shadow p-4">
      <Calendar
        localizer={localizer}
        events={appointments}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '700px' }}
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onNavigate}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        selectable
        eventPropGetter={eventStyleGetter}
        components={components}
        step={15}
        timeslots={4}
        defaultView="week"
        views={['month', 'week', 'day']}
        min={new Date(2024, 0, 1, 8, 0, 0)}
        max={new Date(2024, 0, 1, 18, 0, 0)}
        tooltipAccessor={(event) => {
          const { status, appointmentType, reason, doctorName } = event.resource;
          return `${event.title}\nDoctor: ${doctorName || 'N/A'}\nStatus: ${status}\nType: ${appointmentType}\nReason: ${reason || 'No reason provided'}`;
        }}
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {[
          { color: 'bg-blue-500',   label: 'Scheduled'  },
          { color: 'bg-amber-500',  label: 'Checked In' },
          { color: 'bg-purple-500', label: 'In Progress'},
          { color: 'bg-green-500',  label: 'Completed'  },
          { color: 'bg-red-500',    label: 'Cancelled'  },
          { color: 'bg-gray-500',   label: 'No Show'    },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-4 h-4 ${color} rounded`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentCalendar;