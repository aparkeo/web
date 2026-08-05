'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, CircleParking, CheckCircle2, MapPin, Info, CheckCheck, BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';
import { useMarkNotificationsRead } from '@/hooks/useMarkNotificationsRead';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { cn } from '@/lib/utils';
import type { NotificationDTO, NotificationType } from '@/types';

function NotificationIcon({ type }: { type: NotificationType }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  switch (type) {
    case 'FAVORITE_FREED':
      return <CircleParking className={cn(className, 'text-green-600')} aria-hidden />;
    case 'NEARBY_FREE':
      return <MapPin className={cn(className, 'text-green-600')} aria-hidden />;
    case 'REPORT_CONFIRMED':
      return <CheckCircle2 className={cn(className, 'text-primary')} aria-hidden />;
    default:
      return <Info className={cn(className, 'text-muted-foreground')} aria-hidden />;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const push = usePushSubscription();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const handleTogglePush = async () => {
    if (push.subscribed) {
      const ok = await push.unsubscribe();
      if (ok) {
        toast.success('Avisos desactivados en este dispositivo');
      } else {
        toast.error('No se pudieron desactivar los avisos');
      }
    } else {
      const ok = await push.subscribe();
      if (ok) {
        toast.success('Avisos activados en este dispositivo');
      } else if (push.permission === 'denied' || Notification.permission === 'denied') {
        toast.error(
          'Has bloqueado las notificaciones en el navegador. Actívalas en los ajustes del sitio.',
        );
      } else {
        toast.error('No se pudieron activar los avisos');
      }
    }
  };

  const handleOpen = (notification: NotificationDTO) => {
    if (!notification.read) {
      markRead.mutate({ id: notification.id });
    }
    if (notification.spotId !== null) {
      router.push(`/spots/${notification.spotId}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-11 min-w-11"
          data-tour="notifications"
          aria-label={
            unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markRead.mutate({ all: true })}
              disabled={markRead.isPending}
              className="flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Marcar todas como leídas
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="space-y-2 p-2" aria-label="Cargando notificaciones">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-semibold">Sin notificaciones</p>
            <p className="text-xs text-muted-foreground">
              Cuando una plaza que sigas quede libre, te avisaremos aquí.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => handleOpen(notification)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 px-2 py-2.5',
                  !notification.read && 'bg-secondary/70',
                )}
              >
                <NotificationIcon type={notification.type} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      'whitespace-normal text-sm leading-snug',
                      !notification.read ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {notification.title}
                  </span>
                  <span className="whitespace-normal text-xs text-muted-foreground">
                    {notification.body}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </span>
                {!notification.read ? (
                  <span
                    aria-hidden
                    className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                ) : null}
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {push.supported ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={push.loading}
                aria-pressed={push.subscribed}
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {push.subscribed ? (
                  <>
                    <BellOff className="h-4 w-4 shrink-0" aria-hidden />
                    Desactivar avisos
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4 shrink-0" aria-hidden />
                    {push.loading ? 'Activando…' : 'Activar avisos en este dispositivo'}
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
