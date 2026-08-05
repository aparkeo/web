import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteSpotComment,
  fetchSpotComments,
  postSpotComment,
  setSpotCommentHidden,
} from '@/services/spotContent';
import { useT } from '@/components/i18n/I18nProvider';

export function useSpotComments(spotId: number) {
  return useQuery({
    queryKey: ['spotComments', spotId],
    queryFn: () => fetchSpotComments(spotId),
  });
}

export function usePostSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (body: string) => postSpotComment(spotId, body),
    onSuccess: () => {
      toast.success(t.toasts.commentPublished);
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (commentId: string) => deleteSpotComment(spotId, commentId),
    onSuccess: () => {
      toast.success(t.toasts.commentDeleted);
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useHideSpotComment(spotId: number) {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (commentId: string) => setSpotCommentHidden(spotId, commentId, true),
    onSuccess: () => {
      toast.success(t.toasts.commentHidden);
      queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
