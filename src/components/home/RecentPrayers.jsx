import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function RecentPrayers({ prayers }) {
  if (!prayers || prayers.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune demande de prière</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {prayers.slice(0, 3).map((prayer) => (
        <Card key={prayer.id} className="p-4 hover:shadow-md transition-all duration-200">
          <p className="text-sm line-clamp-2 mb-2">{prayer.content}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {prayer.is_anonymous ? 'Anonyme' : prayer.author_name || 'Membre'}
            </span>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Heart className="w-3 h-3 fill-primary" />
              <span>{prayer.prayer_count || 0} prières</span>
            </div>
          </div>
        </Card>
      ))}
      <Link to="/prayers" className="flex items-center justify-center gap-1 text-sm text-primary font-medium hover:underline">
        Voir toutes les prières <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}