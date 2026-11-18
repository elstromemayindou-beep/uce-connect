import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Settings, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import churchLogo from '@/assets/church-logo.jpg';
import { navigationItems } from '@/lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/I18nContext';
import { toast } from 'sonner';

export default function Sidebar({ collapsed, setCollapsed }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { t } = useLanguage();
  const location = useLocation();
  const { data: branding = {} } = useQuery({ queryKey: ['app-branding'], queryFn: () => appClient.settings.branding() });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });

  return (
    <aside
      className={cn(
        "glass-panel-strong hidden md:flex flex-col bg-sidebar/90 text-sidebar-foreground h-screen fixed left-0 top-0 z-40 transition-all duration-500 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
        <div className="relative">
          <img src={branding.logo_url || churchLogo} alt="" className="h-9 w-9 rounded-xl bg-white object-contain flex-shrink-0 shadow-elev-1" />
          <div className="absolute -right-1 -bottom-1 w-2 h-2 bg-accent rounded-full ring-1 ring-sidebar-background" />
        </div>
        {!collapsed && (
          <span className="font-bold text-xl tracking-tight text-gradient">UCE Connect</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ease-out group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elev-2 border-l-2 border-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground hover:-translate-x-0.5 group-hover:bg-sidebar-accent/20"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12" />
                {isActive && (
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-sidebar-accent-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              {!collapsed && (
                <span className="text-sm font-semibold truncate">{t(item.label)}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section */}
      {user && !collapsed && (
        <div className="px-4 py-6 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <img src={user.avatar_url || churchLogo} alt="" className="h-10 w-10 rounded-2xl object-cover border border-sidebar-border" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full ring-2 ring-card" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.display_name || user.email}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Link to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground transition-colors">
              <Settings className="w-4 h-4" />
              <span>Profil</span>
            </Link>
            <button type="button" disabled={isLoggingOut} onClick={async () => {
              setIsLoggingOut(true);
              try {
                await appClient.auth.logout();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Impossible de fermer la session.');
                setIsLoggingOut(false);
              }
            }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/20 hover:text-sidebar-foreground disabled:opacity-60">
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-sidebar-border hover:bg-sidebar-accent/20 transition-all duration-300 flex items-center justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
