import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, ChevronRight, Users, Music, BookOpen, Zap, Heart, Globe } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { church } from '@/lib/church';
import pastorPhoto from '@/assets/pastor-oko-pichou.jpg';
import { appClient } from '@/api/appClient';

const DEPARTMENT_ICONS = {
  pastor:        { icon: BookOpen, gradient: 'from-indigo-600 to-blue-700',   bg: 'bg-indigo-500/10 text-indigo-600' },
  adjoint:       { icon: Users,    gradient: 'from-blue-600 to-cyan-700',     bg: 'bg-blue-500/10 text-blue-600' },
  deacon:        { icon: Heart,    gradient: 'from-green-600 to-emerald-700', bg: 'bg-green-500/10 text-green-600' },
  worship:       { icon: Music,    gradient: 'from-purple-600 to-violet-700', bg: 'bg-purple-500/10 text-purple-600' },
  youth:         { icon: Zap,      gradient: 'from-amber-500 to-orange-600',  bg: 'bg-amber-500/10 text-amber-600' },
  missions:      { icon: Globe,    gradient: 'from-teal-600 to-cyan-700',     bg: 'bg-teal-500/10 text-teal-600' },
  other:         { icon: Users,    gradient: 'from-slate-500 to-slate-700',   bg: 'bg-slate-500/10 text-slate-600' },
};

export default function Leadership() {
  const [selected, setSelected] = useState(null);
  const { data: branding = {} } = useQuery({ queryKey: ['app-branding'], queryFn: () => appClient.settings.branding() });
  const LEADERSHIP = [
    {
      id: 'pastor-principal',
      name: branding.pastor_name || 'OKO PICHOU',
      role: branding.pastor_role || 'Pasteur principal',
      type: 'pastor',
      bio: `${branding.pastor_role || 'Pasteur principal'} de ${church.name}, à Brazzaville.`,
      image: branding.pastor_photo_url || pastorPhoto,
      email: branding.pastor_email || church.email,
      phone: branding.pastor_phone || church.phone,
    },
    ...(Array.isArray(branding.leaders) ? branding.leaders : []).map((leader, index) => ({
      ...leader,
      id: `leader-${index}`,
      type: 'other',
      bio: leader.bio || '',
      image: leader.photo_url || pastorPhoto,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
        <img
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/92 via-primary/80 to-slate-900/90" />
        <div className="relative z-10 px-6 py-12 md:px-12 text-white min-h-[280px] flex flex-col justify-end">
          <p className="text-amber-400 font-bold tracking-[0.2em] text-xs uppercase mb-2">Église UCE · Brazzaville</p>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-white mb-1">Responsables</h1>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none text-amber-300 mb-3">et contact</h2>
          <p className="text-white/60 text-sm">Découvrez le pasteur principal et les responsables de l’UCE.</p>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">

        {/* UCE contact */}
        {LEADERSHIP.filter(l => l.type === 'pastor').map(leader => (
          <PastorCard key={leader.id} leader={leader} onClick={() => setSelected(leader)} />
        ))}

        {/* Others grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {LEADERSHIP.filter(l => l.type !== 'pastor').map(leader => (
            <LeaderCard key={leader.id} leader={leader} onClick={() => setSelected(leader)} />
          ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="rounded-3xl overflow-hidden p-0 max-w-sm">
          {selected && <LeaderDetail leader={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PastorCard({ leader, onClick }) {
  const conf = DEPARTMENT_ICONS[leader.type] || DEPARTMENT_ICONS.other;
  const Icon = conf.icon;
  return (
    <div
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden cursor-pointer group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
    >
      <img src={leader.image} alt="" className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-2 ${conf.bg}`}>
              <Icon className="w-3 h-3" />{leader.role}
            </div>
            <h2 className="text-white font-black text-2xl">{leader.name}</h2>
            {leader.verse && <p className="text-white/60 text-sm italic mt-1 line-clamp-1">{leader.verse}</p>}
          </div>
          <ChevronRight className="w-6 h-6 text-white/50 group-hover:text-white transition-colors flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

function LeaderCard({ leader, onClick }) {
  const conf = DEPARTMENT_ICONS[leader.type] || DEPARTMENT_ICONS.other;
  const Icon = conf.icon;
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border/50 rounded-3xl overflow-hidden cursor-pointer group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className={`h-1.5 bg-gradient-to-r ${conf.gradient}`} />
      <div className="p-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <img
            src={leader.image}
            alt=""
            className="w-16 h-16 rounded-2xl object-cover shadow-md"
          />
          <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center ${conf.bg} border-2 border-white`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-base truncate">{leader.name}</h3>
          <p className={`text-xs font-bold mt-0.5 ${conf.bg.split(' ')[1]}`}>{leader.role}</p>
          {leader.bio && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{leader.bio}</p>}
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>
    </div>
  );
}

function LeaderDetail({ leader }) {
  const conf = DEPARTMENT_ICONS[leader.type] || DEPARTMENT_ICONS.other;
  const Icon = conf.icon;
  return (
    <>
      <div className="relative h-52">
        <img src={leader.image} alt="" className="w-full h-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black mb-2 ${conf.bg} backdrop-blur-sm`}>
            <Icon className="w-3 h-3" />{leader.role}
          </div>
          <h2 className="text-white font-black text-xl">{leader.name}</h2>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {leader.bio && <p className="text-sm text-muted-foreground leading-relaxed">{leader.bio}</p>}
        {leader.verse && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm italic text-primary font-medium">{leader.verse}</p>
          </div>
        )}
        <div className="space-y-2.5">
          {leader.email && (
            <a href={`mailto:${leader.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/60 hover:bg-primary/5 transition-colors group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${conf.bg}`}>
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold flex-1">{leader.email}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>
          )}
          {leader.phone && (
            <a href={`tel:${leader.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/60 hover:bg-primary/5 transition-colors group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${conf.bg}`}>
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold flex-1">{leader.phone}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}