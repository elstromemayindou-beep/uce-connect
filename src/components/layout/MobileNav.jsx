import React, { lazy, Suspense, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { navigationItems } from '@/lib/navigation';
import { useLanguage } from '@/lib/I18nContext';

const MobileMoreMenu = lazy(() => import('./MobileMoreMenu'));
const primaryPaths = ['/', '/events', '/donations', '/prayers'];
const mobileItems = navigationItems.filter((item) => primaryPaths.includes(item.path));
const allOtherItems = navigationItems.filter((item) => !primaryPaths.includes(item.path));

export default function MobileNav() {
  const { t } = useLanguage();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMoreActive = allOtherItems.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  return (
    <nav aria-label="Navigation principale" className="glass-panel-strong md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] shadow-elev-4">
      <div className="flex justify-around items-center px-2 py-3">
        {mobileItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMoreOpen(false)}
              className={cn(
                "flex min-w-[70px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2 transition-all duration-300",
                isActive
                  ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-elev-2 scale-105"
                  : "text-muted-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
                {isActive && (
                  <div className="absolute -right-1 -top-1 w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-bold leading-none">{t(item.label)}</span>
            </Link>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          aria-label={t('Ouvrir toutes les fonctionnalités')}
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen(true)}
          className={cn(
            'flex h-auto min-w-[70px] flex-col gap-1.5 rounded-2xl px-2 py-2 text-muted-foreground/70',
            isMoreActive && 'bg-gradient-to-br from-primary to-accent text-primary-foreground',
          )}
        >
          <MoreHorizontal className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
          <span className="text-[10px] font-bold leading-none">{t('Plus')}</span>
        </Button>
      </div>
      {isMoreOpen && (
        <Suspense fallback={null}>
          <MobileMoreMenu open onClose={() => setIsMoreOpen(false)} />
        </Suspense>
      )}
    </nav>
  );
}