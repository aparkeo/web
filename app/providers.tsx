'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { UtmTracker } from '@/components/UtmTracker';
import { InstallPromptProvider } from '@/components/InstallPrompt';
import { OnboardingTourProvider } from '@/components/OnboardingTour';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import type { Dictionary, Locale } from '@/lib/i18n';

// Sonner no detecta solo la clase .dark de next-themes: hay que pasarle el tema resuelto.
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-center" richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <I18nProvider locale={locale} dict={dict}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <InstallPromptProvider>
              <OnboardingTourProvider>{children}</OnboardingTourProvider>
            </InstallPromptProvider>
            <OfflineIndicator />
            <ServiceWorkerRegistration />
            <UtmTracker />
            <ThemedToaster />
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
