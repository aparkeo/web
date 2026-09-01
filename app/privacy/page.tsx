import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_GITHUB_URL } from '@/lib/site';
import { SUPPORT_CONTACT_EMAIL } from '@/lib/support';
import { getServerDictionary } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/format';

export const metadata: Metadata = {
  title: 'Privacidad',
  description:
    'Política de privacidad de Aparkeo: qué datos recogemos, para qué, qué base jurídica nos ampara y cómo ejercer tus derechos RGPD (acceso, rectificación, supresión, portabilidad y oposición).',
  alternates: { canonical: '/privacy' },
};

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="home-fade-up rounded-2xl shadow-elevated">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{kicker}</p>
        <CardTitle className="tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export default async function PrivacyPage() {
  const t = await getServerDictionary();

  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.privacy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {fmt(t.privacy.intro, { date: t.privacy.lastUpdated })}
        </p>
      </header>

      <Section kicker={t.privacy.responsibleKicker} title={t.privacy.responsibleTitle}>
        <p>{t.privacy.responsibleBody1}</p>
        <p>
          {t.privacy.responsibleBody2a}
          <a
            href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {SUPPORT_CONTACT_EMAIL}
          </a>
          {t.privacy.responsibleBody2b}
          <a
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {SITE_GITHUB_URL.replace('https://', '')}
          </a>
          {t.privacy.responsibleBody2c}
        </p>
      </Section>

      <Section kicker={t.privacy.dataKicker} title={t.privacy.dataTitle}>
        <p>{t.privacy.dataIntro}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">{t.privacy.dataAccount}</strong>
            {t.privacy.dataAccountBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataReports}</strong>
            {t.privacy.dataReportsBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataPhotos}</strong>
            {t.privacy.dataPhotosBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataFavorites}</strong>
            {t.privacy.dataFavoritesBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataPush}</strong>
            {t.privacy.dataPushBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataNotifications}</strong>
            {t.privacy.dataNotificationsBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataEvents}</strong>
            {t.privacy.dataEventsBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.dataPredictions}</strong>
            {t.privacy.dataPredictionsBody}
          </li>
        </ul>
        <p>{t.privacy.dataNoSell}</p>
      </Section>

      <Section kicker={t.privacy.legalKicker} title={t.privacy.legalTitle}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">{t.privacy.legalInterest}</strong>
            {t.privacy.legalInterestBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.legalConsent}</strong>
            {t.privacy.legalConsentBody}
          </li>
        </ul>
      </Section>

      <Section kicker={t.privacy.thirdKicker} title={t.privacy.thirdTitle}>
        <p>{t.privacy.thirdBody}</p>
      </Section>

      <Section kicker={t.privacy.retentionKicker} title={t.privacy.retentionTitle}>
        <p>{t.privacy.retentionBody}</p>
      </Section>

      <Section kicker={t.privacy.rightsKicker} title={t.privacy.rightsTitle}>
        <p>{t.privacy.rightsIntro}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">{t.privacy.rightsAccess}</strong>
            {t.privacy.rightsAccessBody1}
            <Link href="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t.privacy.yourProfile}
            </Link>
            {t.privacy.rightsAccessBody2}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.rightsRectification}</strong>
            {t.privacy.rightsRectificationBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.rightsErasure}</strong>
            {t.privacy.rightsErasureBody1}
            <Link href="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t.privacy.yourProfile}
            </Link>
            {t.privacy.rightsErasureBody2}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.rightsObjection}</strong>
            {t.privacy.rightsObjectionBody}
          </li>
        </ul>
        <p>
          {t.privacy.rightsContactA}
          <a
            href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {SUPPORT_CONTACT_EMAIL}
          </a>
          {t.privacy.rightsContactMid}
          <a
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.privacy.rightsContactRepo}
          </a>
          {t.privacy.rightsContactB}
        </p>
      </Section>

      <Section kicker={t.privacy.cookiesKicker} title={t.privacy.cookiesTitle}>
        <p>
          {t.privacy.cookiesIntroA}
          <strong className="text-foreground">{t.privacy.cookiesIntroStrong}</strong>
          {t.privacy.cookiesIntroB}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">{t.privacy.cookieSession}</strong>
            {t.privacy.cookieSessionBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.cookieLang}</strong>
            {t.privacy.cookieLangBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.cookiePrefs}</strong>
            {t.privacy.cookiePrefsBody}
          </li>
          <li>
            <strong className="text-foreground">{t.privacy.cookieSessionStorage}</strong>
            {t.privacy.cookieSessionStorageBody}
          </li>
        </ul>
        <p>{t.privacy.cookiesFooter}</p>
      </Section>

      <Section kicker={t.privacy.changesKicker} title={t.privacy.changesTitle}>
        <p>{t.privacy.changesBody}</p>
      </Section>
    </div>
  );
}
