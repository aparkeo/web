'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Camera, EyeOff, ImageOff, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDeleteSpotPhoto, useHideSpotPhoto, useSpotPhotos, useUploadSpotPhoto } from '@/hooks/useSpotPhotos';
import { compressImage } from '@/lib/compressImage';
import { formatRelativeTime } from '@/lib/utils';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import type { SpotPhotoDTO } from '@/lib/spotContent';

/**
 * Sección «Fotos» del detalle de plaza (roadmap nº9): galería con lightbox,
 * subida con preview local (solo usuarios logueados) y moderación
 * (el autor borra; MODERATOR/ADMIN ocultan).
 */
export function SpotPhotos({ spotId, street }: { spotId: number; street: string }) {
  const { data: session } = useSession();
  const { data: photos, isLoading } = useSpotPhotos(spotId);
  const [lightbox, setLightbox] = useState<SpotPhotoDTO | null>(null);
  const t = useT();

  const isModerator = session?.user.role === 'MODERATOR' || session?.user.role === 'ADMIN';

  return (
    <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg font-bold tracking-tight">{t.photos.title}</CardTitle>
        {session?.user ? (
          <UploadButton spotId={spotId} />
        ) : (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href="/login">{t.photos.loginToUpload}</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !photos || photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {t.photos.empty}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                spotId={spotId}
                street={street}
                canDelete={session?.user.id === photo.authorId}
                canHide={isModerator && session?.user.id !== photo.authorId}
                onOpen={() => setLightbox(photo)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2 sm:p-4" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{fmt(t.photos.lightboxTitle, { street })}</DialogTitle>
          {lightbox ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dinámica de Supabase Storage */}
              <img
                src={lightbox.url}
                alt={fmt(t.photos.lightboxAlt, { street, name: lightbox.authorName })}
                className="max-h-[75vh] w-full rounded-xl object-contain"
              />
              <p className="text-center text-xs text-muted-foreground">
                {lightbox.authorName} · {formatRelativeTime(new Date(lightbox.createdAt), t.time)}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PhotoTile({
  photo,
  spotId,
  street,
  canDelete,
  canHide,
  onOpen,
}: {
  photo: SpotPhotoDTO;
  spotId: number;
  street: string;
  canDelete: boolean;
  canHide: boolean;
  onOpen: () => void;
}) {
  const deletePhoto = useDeleteSpotPhoto(spotId);
  const hidePhoto = useHideSpotPhoto(spotId);
  const t = useT();

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver foto de la plaza en ${street} subida por ${photo.authorName}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL dinámica de Supabase Storage */}
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => deletePhoto.mutate(photo.id)}
          disabled={deletePhoto.isPending}
          aria-label={t.photos.deleteMine}
          className="absolute right-1.5 top-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background/80 text-destructive opacity-100 shadow-sm backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : canHide ? (
        <button
          type="button"
          onClick={() => hidePhoto.mutate(photo.id)}
          disabled={hidePhoto.isPending}
          aria-label={t.photos.hideModeration}
          className="absolute right-1.5 top-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-100 shadow-sm backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function UploadButton({ spotId }: { spotId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadSpotPhoto(spotId);
  const [pending, setPending] = useState<{ file: File; previewUrl: string } | null>(null);
  const t = useT();

  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFilePicked = (file: File | undefined) => {
    if (!file) return;
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  };

  const confirmUpload = async () => {
    if (!pending) return;
    const compressed = await compressImage(pending.file);
    const file = new File([compressed], pending.file.name, { type: compressed.type });
    clearPending();
    upload.mutate(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => onFilePicked(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        className="btn-cta min-h-11 gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        {upload.isPending ? t.photos.uploading : t.photos.upload}
      </Button>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && clearPending()}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogTitle>{t.photos.confirmTitle}</DialogTitle>
          {pending ? (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local de blob: */}
              <img
                src={pending.previewUrl}
                alt={t.photos.previewAlt}
                className="max-h-[50vh] w-full rounded-xl object-contain"
              />
              <p className="text-xs text-muted-foreground">
                {t.photos.resizeNote}
              </p>
              <div className="flex gap-2">
                <Button type="button" className="btn-cta min-h-11 flex-1 gap-2" onClick={confirmUpload}>
                  <Camera className="h-4 w-4" aria-hidden="true" /> {t.photos.publish}
                </Button>
                <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={clearPending}>
                  <X className="h-4 w-4" aria-hidden="true" /> {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
