import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteSpotPhoto,
  fetchSpotPhotos,
  setSpotPhotoHidden,
  uploadSpotPhoto,
} from '@/services/spotContent';
import { useT } from '@/components/i18n/I18nProvider';

export function useSpotPhotos(spotId: number) {
  return useQuery({
    queryKey: ['spotPhotos', spotId],
    queryFn: () => fetchSpotPhotos(spotId),
  });
}

export function useUploadSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (file: File) => uploadSpotPhoto(spotId, file),
    onSuccess: () => {
      toast.success(t.toasts.photoPublished);
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (photoId: string) => deleteSpotPhoto(spotId, photoId),
    onSuccess: () => {
      toast.success(t.toasts.photoDeleted);
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useHideSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (photoId: string) => setSpotPhotoHidden(spotId, photoId, true),
    onSuccess: () => {
      toast.success(t.toasts.photoHidden);
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
