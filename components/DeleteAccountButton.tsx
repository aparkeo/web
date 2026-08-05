'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';

const CONFIRM_WORD = 'ELIMINAR';

/**
 * Botón «Eliminar mi cuenta» con diálogo de confirmación que exige escribir
 * ELIMINAR. Llama a DELETE /api/user y, si sale bien, cierra sesión y vuelve
 * a la home. Si el servidor responde 409 (único administrador), muestra el
 * motivo sin cerrar sesión.
 */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const t = useT();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/user', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t.profile.deletedToast);
        // Cierra sesión y redirige a la home (el JWT quedaría huérfano).
        await signOut({ callbackUrl: '/' });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? t.profile.deleteError);
      setDeleting(false);
    } catch {
      toast.error(t.profile.networkError);
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmation('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">{t.profile.deleteButton}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            {t.profile.deleteDialogTitle}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                {t.profile.deleteDialogBody1a}
                <strong className="text-foreground">{t.profile.deleteDialogIrreversible}</strong>
                {t.profile.deleteDialogBody1b}
              </p>
              <p>
                {t.profile.deleteDialogBody2a}
                <strong className="text-foreground">{CONFIRM_WORD}</strong>
                {t.profile.deleteDialogBody2b}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirmation">{t.profile.deleteConfirmLabel}</Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            disabled={deleting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmation !== CONFIRM_WORD || deleting}
          >
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t.profile.deleteForever}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
