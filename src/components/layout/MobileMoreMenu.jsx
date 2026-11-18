import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { navigationItems } from '@/lib/navigation';
import { useLanguage } from '@/lib/I18nContext';

export default function MobileMoreMenu({ open, onClose }) {
  const location = useLocation();
  const { t } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="bottom" className="glass-panel max-h-[82dvh] overflow-y-auto rounded-t-3xl border-x-0 border-b-0 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="mb-5 pr-8 text-left">
          <SheetTitle className="text-xl font-black">{t('Toutes les fonctionnalités')}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t('Retrouvez chaque espace de l’application ici.')}</p>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {navigationItems.map((item, index) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'glass-card group relative flex min-h-28 flex-col justify-between rounded-2xl bg-background/70 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-elev-2 sm:min-h-32 sm:rounded-3xl sm:p-4',
                  isActive && 'border-primary/35 bg-primary/5 shadow-sm',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm transition group-hover:scale-105 sm:h-10 sm:w-10 sm:rounded-2xl">
                    <item.icon className={cn('h-4 w-4 sm:h-5 sm:w-5', item.color)} />
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 text-muted-foreground/70 transition group-hover:bg-primary/10 group-hover:text-primary">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="mt-4 flex w-full items-end justify-between gap-1">
                  <span className="text-xs font-bold leading-tight text-foreground">{t(item.label)}</span>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
