import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteSpotComment,
  fetchSpotComments,
  postSpotComment,
  setSpotCommentHidden,
} from '@/services/spotContent';

export function useSpotComments(spotId: number) {
  return useQuery({
    queryKey: ['spotComments', spotId],
    queryFn: () => fetchSpotComments(spotId),
  });
}

export function usePostSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postSpotComment(spotId, body),
    onSuccess: () => {
      toast.success('Comentario publicado');
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteSpotComment(spotId, commentId),
    onSuccess: () => {
      toast.success('Comentario eliminado');
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useHideSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => setSpotCommentHidden(spotId, commentId, true),
    onSuccess: () => {
      toast.success('Comentario ocultado');
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
