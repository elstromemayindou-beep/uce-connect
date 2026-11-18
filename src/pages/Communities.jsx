import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Users, Globe, Phone, Mail } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function Communities() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => appClient.entities.Community.list(),
  });

  const filtered = communities.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase()) ||
    c.country?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      {/* Hero avec image de fond */}
      <div className="relative z-10 min-h-[24rem] overflow-hidden text-white">
        <img
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"
          alt="Communauté"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative flex h-full items-end justify-between gap-4 px-6 py-12 md:px-12 md:py-16">
          <div className="mb-8">
            <p className="text-amber-400 font-bold tracking-widest text-xs uppercase mb-2 shadow-md">Brazzaville • République du Congo</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-white shadow-lg shadow-black/40">Communautés UCE</h1>
            <p className="text-white/90 mt-3 text-lg leading-relaxed shadow-md shadow-black/30">Découvrez les communautés et groupes de l’Église UCE</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40">
            <Search className="w-4 h-4" />
          </div>
          <Input
            placeholder="Rechercher par nom, ville ou pays..."
            className="pl-10 h-11 rounded-2xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-accent" />
            <span className="text-foreground font-bold">{filtered.length}</span>
          </div>
          <span>communauté{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="glass-card rounded-3xl h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-4 opacity-50">
              <Globe className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="font-bold text-lg text-foreground">Aucune communauté trouvée</p>
            <p className="text-sm text-muted-foreground mt-2">Essayez d'ajuster vos critères de recherche</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((community) => (
              <div
                key={community.id}
                className="glass-card rounded-3xl overflow-hidden cursor-pointer group transition-all duration-300 hover:border-primary/40 hover:shadow-elev-4"
                onClick={() => setSelected(community)}
              >
                <div className="relative h-48 bg-primary/5 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={community.logo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=70'}
                    alt={community.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=70'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-accent text-accent-foreground rounded-xl px-3 py-1 text-xs font-bold shadow-elev-1">{community.city}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg leading-tight mb-2 text-foreground">{community.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-foreground/75 mb-3">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{community.city}, {community.country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                    <Users className="w-3 h-3" />
                    <span>{community.member_count || 0} membres</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md rounded-3xl overflow-hidden p-0 shadow-elev-4">
          <div className="bg-gradient-to-br from-primary to-primary/70 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-elev-2">
                {selected?.logo_url ? (
                  <img src={selected.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black">{selected?.name?.[0]}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{selected?.name}</h2>
                {(selected?.city || selected?.country) && (
                  <div className="flex items-center gap-1 text-white/90 text-sm mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {selected?.city}{selected?.country ? `, ${selected?.country}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {selected?.description && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">À propos</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
              </div>
            )}
            <div className="space-y-3">
              {selected?.pastor_name && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border/50 text-sm">
                  <span className="text-muted-foreground">Pasteur</span>
                  <span className="font-bold text-foreground">{selected.pastor_name}</span>
                </div>
              )}
              {selected?.leader_name && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border/50 text-sm">
                  <span className="text-muted-foreground">Responsable de la communauté</span>
                  <span className="font-bold text-foreground">{selected.leader_name}</span>
                </div>
              )}
              {selected?.member_count > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border/50 text-sm">
                  <span className="text-muted-foreground">Membres</span>
                  <span className="font-bold text-foreground">{selected.member_count}</span>
                </div>
              )}
            </div>
            {(selected?.contact_email || selected?.contact_phone) && (
              <div className="space-y-3">
                {selected.contact_email && (
                  <a href={`mailto:${selected.contact_email}`} className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary text-sm font-semibold hover:bg-primary/10 hover:border-primary/20 transition-all">
                    <Mail className="w-4 h-4" />{selected.contact_email}
                  </a>
                )}
                {selected.contact_phone && (
                  <a href={`tel:${selected.contact_phone}`} className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary text-sm font-semibold hover:bg-primary/10 hover:border-primary/20 transition-all">
                    <Phone className="w-4 h-4" />{selected.contact_phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}