import type { MarkNotificationsReadInput, NotificationsResponse } from '@/types';

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('No se pudieron cargar las notificaciones');
  return res.json();
}

export async function markNotificationsRead(
  payload: MarkNotificationsReadInput,
): Promise<{ ok: boolean; updated: number }> {
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('No se pudieron marcar las notificaciones como leídas');
  return res.json();
}
