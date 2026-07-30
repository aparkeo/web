import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitReport } from '@/services/reports';
import { toast } from 'sonner';
import type { ReportInput } from '@/types';

export function useReportSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReportInput) => submitReport(input),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'FREE' ? '✓ Reportada como libre' : '✓ Reportada como ocupada');
      queryClient.invalidateQueries({ queryKey: ['spots'] });
      queryClient.invalidateQueries({ queryKey: ['spot', variables.spotId] });
      queryClient.invalidateQueries({ queryKey: ['best-spot'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
