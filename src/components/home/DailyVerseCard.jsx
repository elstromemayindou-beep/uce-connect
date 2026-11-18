import React from 'react';
import { BookOpen, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DailyVerseCard({ verse }) {
  if (!verse) return null;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-6 md:p-8">
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5" />
          <span className="text-sm font-medium opacity-80">Verset du jour</span>
        </div>
        
        <blockquote className="text-lg md:text-xl font-medium leading-relaxed mb-4 italic">
          "{verse.text}"
        </blockquote>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold opacity-90">— {verse.reference}</span>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ text: `"${verse.text}" — ${verse.reference}` });
              }
            }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}