import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitReport } from '@/services/reports';
import { toast } from 'sonner';
import { useT } from '@/components/i18n/I18nProvider';
import type { ReportInput } from '@/types';

export function useReportSpot() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (input: ReportInput) => submitReport(input),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'FREE' ? t.toasts.reportedFree : t.toasts.reportedOccupied);
      queryClient.invalidateQueries({ queryKey: ['spots'] });
      queryClient.invalidateQueries({ queryKey: ['spot', variables.spotId] });
      queryClient.invalidateQueries({ queryKey: ['best-spot'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
