import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteSpotPhoto,
  fetchSpotPhotos,
  setSpotPhotoHidden,
  uploadSpotPhoto,
} from '@/services/spotContent';

export function useSpotPhotos(spotId: number) {
  return useQuery({
    queryKey: ['spotPhotos', spotId],
    queryFn: () => fetchSpotPhotos(spotId),
  });
}

export function useUploadSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadSpotPhoto(spotId, file),
    onSuccess: () => {
      toast.success('Foto publicada');
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => deleteSpotPhoto(spotId, photoId),
    onSuccess: () => {
      toast.success('Foto eliminada');
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useHideSpotPhoto(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => setSpotPhotoHidden(spotId, photoId, true),
    onSuccess: () => {
      toast.success('Foto ocultada');
      queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
