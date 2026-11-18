import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const typeColors = {
  service: 'bg-blue-500',
  conference: 'bg-purple-500',
  camp: 'bg-green-500',
  youth: 'bg-amber-500',
  prayer: 'bg-red-500',
  retreat: 'bg-teal-500',
  other: 'bg-slate-400',
};

export default function EventCalendarView({ events, onSelectEvent }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  // Pad the first week
  const firstDayOfWeek = start.getDay(); // 0=Sun
  const padStart = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon-first

  const getEventsForDay = (day) =>
    events.filter(e => e.date && isSameDay(new Date(e.date), day));

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="bg-card border border-border/50 rounded-3xl overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-black text-base capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h3>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Week headers */}
      <div className="grid grid-cols-7 border-b border-border/30">
        {weekDays.map(d => (
          <div key={d} className="text-center py-2 text-xs font-bold text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {/* Empty pads */}
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[64px] border-b border-r border-border/20 bg-muted/20" />
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[64px] p-1 border-b border-r border-border/20 ${!isCurrentMonth ? 'bg-muted/20' : ''}`}
            >
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold mb-1 mx-auto
                ${today ? 'bg-primary text-white' : 'text-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-semibold text-white truncate leading-tight ${typeColors[ev.type] || 'bg-slate-400'}`}
                  >
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 2}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}