import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { cn } from '@/lib/utils';
import { appClient } from '@/api/appClient';
import { applyBranding } from '@/lib/branding';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { usePwa } from '@/lib/PwaContext';

const AdminContextMenu = lazy(() => import('./AdminContextMenu'));

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { online } = usePwa();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: branding = {} } = useQuery({
    queryKey: ['app-branding'],
    queryFn: () => appClient.settings.branding(),
    staleTime: 60_000,
  });
  const databaseHealth = useQuery({
    queryKey: ['database-health'],
    queryFn: async () => {
      const response = await fetch('/api/db-health');
      if (!response.ok) throw new Error('Database unavailable');
      return response.json();
    },
    retry: false,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  useEffect(() => {
    let startPoint = null;

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) {
        startPoint = null;
        return;
      }

      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [data-no-swipe-back]')) {
        startPoint = null;
        return;
      }

      const edge = Math.min(28, window.innerWidth * 0.06);
      if (touch.clientX <= edge || touch.clientX >= window.innerWidth - edge) {
        startPoint = { x: touch.clientX, y: touch.clientY };
      } else {
        startPoint = null;
      }
    };

    const handleTouchEnd = (event) => {
      if (!startPoint || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startPoint.x;
      const deltaY = touch.clientY - startPoint.y;
      const beganAtLeftEdge = startPoint.x <= Math.min(28, window.innerWidth * 0.06);
      startPoint = null;

      if (Math.abs(deltaX) < 80 || Math.abs(deltaY) > 60) return;
      if (beganAtLeftEdge ? deltaX < 0 : deltaX > 0) return;

      if (window.history.state?.idx > 0) {
        navigate(-1);
      } else if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    };

    const handleTouchCancel = () => {
      startPoint = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main
        className={cn(
          "transition-all duration-300 pb-20 md:pb-0",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:text-amber-100 sm:text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />Mode hors connexion : les chapitres bibliques déjà consultés restent disponibles.
          </div>
        )}
        {databaseHealth.isError && online && (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:text-amber-100 sm:text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>La connexion aux données est interrompue. Certains contenus peuvent ne pas se charger.</span>
            <button type="button" onClick={() => databaseHealth.refetch()} disabled={databaseHealth.isFetching} className="inline-flex items-center gap-1 rounded-full px-2 py-1 underline underline-offset-2 disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${databaseHealth.isFetching ? 'animate-spin' : ''}`} />
              Réessayer
            </button>
          </div>
        )}
        <Suspense fallback={null}><AdminContextMenu /></Suspense>
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
