'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2, XCircle, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useReportSpot } from '@/hooks/useReportSpot';

interface ReportModalProps {
  spotId: number;
  street: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportModal({ spotId, street, open, onOpenChange }: ReportModalProps) {
  const { status: sessionStatus } = useSession();
  const reportSpot = useReportSpot();
  const [choice, setChoice] = useState<'FREE' | 'OCCUPIED' | null>(null);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number; accuracyM: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocalización no disponible en este dispositivo.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setLocError(err.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener la ubicación.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const handleSubmit = async () => {
    if (!choice) return;
    await reportSpot.mutateAsync({
      spotId,
      status: choice,
      ...(location ? { lat: location.lat, lon: location.lon, accuracyM: location.accuracyM } : {}),
    });
    setChoice(null);
    setLocation(null);
    setLocError(null);
    onOpenChange(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setChoice(null);
      setLocation(null);
      setLocError(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar estado de la plaza</DialogTitle>
          <DialogDescription>{street}</DialogDescription>
        </DialogHeader>

        {sessionStatus !== 'authenticated' ? (
          <p className="text-sm text-muted-foreground">
            Necesitas iniciar sesión para reportar el estado de una plaza.
          </p>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChoice('FREE')}
                aria-pressed={choice === 'FREE'}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 ${
                  choice === 'FREE' ? 'border-free bg-free/10 shadow-md' : 'border-border hover:bg-secondary'
                }`}
              >
                <CheckCircle2 className="h-7 w-7 text-free" />
                <span className="font-semibold">Está libre</span>
              </button>
              <button
                type="button"
                onClick={() => setChoice('OCCUPIED')}
                aria-pressed={choice === 'OCCUPIED'}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 ${
                  choice === 'OCCUPIED' ? 'border-destructive bg-destructive/10 shadow-md' : 'border-border hover:bg-secondary'
                }`}
              >
                <XCircle className="h-7 w-7 text-destructive" />
                <span className="font-semibold">Está ocupada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={captureLocation}
              disabled={locating}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm transition-[background-color,border-color] duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <MapPin className="h-4 w-4 text-primary" />
              {locating
                ? 'Obteniendo ubicación…'
                : location
                  ? `Ubicación capturada (±${Math.round(location.accuracyM)} m)`
                  : 'Añadir mi ubicación (mejora la fiabilidad)'}
            </button>

            {locError ? <p className="text-xs text-destructive">{locError}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => handleClose(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!choice || sessionStatus !== 'authenticated' || reportSpot.isPending}
            className="btn-cta min-h-11 rounded-xl font-bold"
          >
            {reportSpot.isPending ? 'Enviando…' : 'Enviar reporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
