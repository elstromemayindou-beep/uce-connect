import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { ArrowLeft, CalendarDays, Network, Users } from 'lucide-react';

export default function OrganizationWorkspace() {
  const { departmentId, commissionId } = useParams();
  const { data: departments = [], isLoading, isError } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => appClient.organization.tree(),
  });
  const department = departments.find((item) => item.id === departmentId
    || item.commissions.some((commission) => commission.id === commissionId));
  const selectedCommission = department?.commissions.find((commission) => commission.id === commissionId);

  if (isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Chargement de votre espace…</p>;
  }

  if (isError) {
    return <p role="alert" className="p-8 text-center text-destructive">Impossible de charger votre périmètre organisationnel.</p>;
  }

  if (!department || (commissionId && !selectedCommission)) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-black">Périmètre inaccessible</h1>
        <p className="mt-2 text-muted-foreground">Aucun rôle actif ne vous donne accès à ce département ou à cette commission.</p>
        <Link to="/admin" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
          <ArrowLeft className="h-4 w-4" />Retour aux espaces
        </Link>
      </div>
    );
  }

  const title = selectedCommission?.nom || department.nom;
  const memberCount = Number(selectedCommission?.nombre_membres ?? department.nombre_membres ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft className="h-4 w-4" />Tous mes espaces
      </Link>

      <header className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Network className="mb-4 h-10 w-10 text-primary" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {selectedCommission ? department.nom : 'Espace départemental'}
            </p>
            <h1 className="mt-1 text-3xl font-black">{title}</h1>
            {(selectedCommission?.description || department.description) && (
              <p className="mt-2 max-w-3xl text-muted-foreground">
                {selectedCommission?.description || department.description}
              </p>
            )}
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Users className="h-4 w-4" />{memberCount} affectations actives
            </div>
          </div>
          <Link
            to="/admin/content?tab=events"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/40 hover:bg-primary/5"
          >
            <CalendarDays className="h-4 w-4" />Gérer les événements
          </Link>
        </div>
      </header>

      {!selectedCommission && (
        <section className="glass-panel rounded-3xl p-5 md:p-7">
          <h2 className="mb-4 text-xl font-black">Commissions rattachées</h2>
          {department.commissions.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Aucune commission active rattachée à ce département.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {department.commissions.map((commission) => (
                <Link
                  key={commission.id}
                  to={`/admin/commissions/${commission.id}`}
                  className="rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:shadow-md"
                >
                  <h3 className="font-bold">{commission.nom}</h3>
                  {commission.description && <p className="mt-1 text-sm text-muted-foreground">{commission.description}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">{commission.nombre_membres} affectations actives</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {memberCount === 0 && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
          Aucune affectation de membre n’est encore enregistrée dans ce périmètre.
        </p>
      )}
    </div>
  );
}
