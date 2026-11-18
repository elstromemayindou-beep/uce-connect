import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function UpcomingEvents({ events }) {
  if (!events || events.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucun événement à venir</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {events.slice(0, 3).map((event) => (
        <Link key={event.id} to={`/events?id=${event.id}`}>
          <Card className="p-4 hover:shadow-md transition-all duration-200 group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary uppercase">
                  {event.date ? format(new Date(event.date), 'MMM', { locale: fr }) : '—'}
                </span>
                <span className="text-lg font-bold text-primary">
                  {event.date ? format(new Date(event.date), 'd') : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{event.location || 'Lieu non défini'}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}