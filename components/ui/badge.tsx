import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        /* Colores de texto en claro endurecidos para AA (>=4.5:1 sobre su fondo
           tintado al 15%): success #166534, warning #92400E, muted #475569 */
        success: 'border-transparent bg-free/15 text-[#166534] dark:text-[#4ADE80]',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        warning: 'border-transparent bg-disputed/15 text-[#92400E] dark:text-[#FBBF24]',
        muted: 'border-transparent bg-unknown/15 text-[#475569] dark:text-[#94A3B8]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
