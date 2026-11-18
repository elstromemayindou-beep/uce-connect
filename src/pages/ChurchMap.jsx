import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { appClient } from '@/api/appClient';
import { church as defaultChurch } from '@/lib/church';
import { useLanguage } from '@/lib/I18nContext';

const brazzavilleCenter = [-4.25, 15.28];

function MapViewport({ destination, route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route, { padding: [40, 40], maxZoom: 15 });
    } else if (destination) {
      map.setView(destination, 15);
    }
  }, [destination, map, route]);

  return null;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  });
}

export default function ChurchMap() {
  const { t } = useLanguage();
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => appClient.auth.me(),
  });
  const church = { ...defaultChurch, ...(user?.church || {}) };
  const address = [church.address, church.city, church.country].filter(Boolean).join(', ');
  const searchAddress = address;
  const [destination, setDestination] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [position, setPosition] = useState(null);
  const [route, setRoute] = useState([]);
  const [routeDetails, setRouteDetails] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [isFindingRoute, setIsFindingRoute] = useState(false);

  useEffect(() => {
    if (isUserLoading || !searchAddress) return undefined;

    const controller = new AbortController();
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      q: searchAddress,
    });

    setDestination(null);
    setLocationError(false);
    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'fr' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Address lookup failed');
        return response.json();
      })
      .then((results) => {
        const result = Array.isArray(results) ? results[0] : null;
        const latitude = Number(result?.lat);
        const longitude = Number(result?.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocationError(true);
          return;
        }
        setDestination([latitude, longitude]);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLocationError(true);
      });

    return () => controller.abort();
  }, [isUserLoading, searchAddress]);

  const findRoute = async () => {
    setRouteError('');
    setRoute([]);
    setRouteDetails(null);
    setIsFindingRoute(true);

    try {
      if (!destination) throw new Error('CHURCH_LOCATION_UNAVAILABLE');
      if (!navigator.geolocation) throw new Error('GEOLOCATION_UNAVAILABLE');

      const currentPosition = await getCurrentPosition();
      const current = [currentPosition.coords.latitude, currentPosition.coords.longitude];
      setPosition(current);

      const coordinates = `${current[1]},${current[0]};${destination[1]},${destination[0]}`;
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
      );
      if (!response.ok) throw new Error('ROUTE_LOOKUP_FAILED');

      const result = await response.json();
      const routeResult = result.routes?.[0];
      if (result.code !== 'Ok' || !routeResult?.geometry?.coordinates?.length) {
        throw new Error('ROUTE_LOOKUP_FAILED');
      }

      setRoute(routeResult.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]));
      setRouteDetails({ distance: routeResult.distance, duration: routeResult.duration });
    } catch (error) {
      if (error.message === 'CHURCH_LOCATION_UNAVAILABLE') {
        setRouteError(t('La position de l’église est introuvable à partir de son adresse.'));
      } else if (error.message === 'GEOLOCATION_UNAVAILABLE') {
        setRouteError(t('La géolocalisation n’est pas disponible sur cet appareil.'));
      } else if (error.code === 1) {
        setRouteError(t('Autorisez la géolocalisation dans votre navigateur pour calculer l’itinéraire.'));
      } else if (error.code === 3) {
        setRouteError(t('La localisation a pris trop de temps. Réessayez.'));
      } else if (error.code === 2) {
        setRouteError(t('Votre position n’a pas pu être déterminée. Vérifiez votre signal et réessayez.'));
      } else {
        setRouteError(t('Impossible de calculer le trajet. Vérifiez votre connexion et réessayez.'));
      }
    } finally {
      setIsFindingRoute(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      <header className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-primary px-6 py-10 text-white md:px-12">
        <div aria-hidden="true" className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            <MapPin className="h-4 w-4" />{t('Nous trouver')}
          </p>
          <h1 className="text-4xl font-black text-white md:text-5xl">{church.name || church.shortName}</h1>
          <p className="mt-3 flex items-start gap-2 text-sm text-white/85 md:text-base">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>{address}</span>
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <section className="glass-panel overflow-hidden rounded-3xl shadow-elev-3">
          <MapContainer
            center={brazzavilleCenter}
            zoom={13}
            scrollWheelZoom
            className="h-[55vh] min-h-[360px] w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport destination={destination} route={route} />
            {destination && (
              <CircleMarker center={destination} radius={11} pathOptions={{ color: '#b45309', fillColor: '#fbbf24', fillOpacity: 1 }}>
                <Popup>{church.name || church.shortName} — {t('Emplacement approximatif selon l’adresse')}</Popup>
              </CircleMarker>
            )}
            {position && (
              <CircleMarker center={position} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 1 }}>
                <Popup>{t('Votre position')}</Popup>
              </CircleMarker>
            )}
            {route.length > 0 && (
              <Polyline positions={route} pathOptions={{ color: '#4f46e5', weight: 6, opacity: 0.85 }} />
            )}
          </MapContainer>
        </section>

        <section className="glass-panel flex flex-col items-start justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center md:p-6">
          <div>
            <h2 className="text-xl font-black">{t('Itinéraire vers l’église')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {locationError
                ? t('La position de l’église est introuvable à partir de son adresse.')
                : !destination
                  ? t('Localisation de l’église en cours…')
                  : t('Le repère correspond à l’adresse indiquée et peut ne pas marquer l’entrée exacte.')}
            </p>
            {routeDetails && (
              <p className="mt-2 text-sm font-semibold text-foreground">
                {t('Distance')}: {(routeDetails.distance / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
                {' · '}
                {t('Durée estimée')}: {Math.max(1, Math.round(routeDetails.duration / 60))} min
              </p>
            )}
            {routeError && <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{routeError}</p>}
          </div>
          <Button
            type="button"
            onClick={findRoute}
            disabled={isFindingRoute || !destination}
            className="w-full shrink-0 rounded-2xl bg-primary text-primary-foreground sm:w-auto"
          >
            <Navigation className="h-4 w-4" />
            {isFindingRoute ? t('Calcul de l’itinéraire…') : t('Tracer l’itinéraire')}
          </Button>
        </section>
      </main>
    </div>
  );
}
