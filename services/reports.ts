import type { ReportInput } from '@/types';

export async function submitReport(input: ReportInput): Promise<{ ok: true; spotId: number }> {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(body.error ?? 'No se pudo enviar el reporte');
  }
  return res.json();
}
