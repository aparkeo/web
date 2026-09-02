import { ImageResponse } from 'next/og';
import { SITE_URL } from '@/lib/site';

// Tarjeta OG de marca (1200×630): la primera impresión al pegar el enlace en
// WhatsApp, X o Telegram. SVG no vale: esas plataformas exigen PNG/JPG.
// Logo definitivo (pin + wordmark) sobre tarjeta clara, servido como asset
// estático desde /brand/aparkeo-logo.png.
export const runtime = 'edge';
export const alt = 'Aparkeo — Plazas PMR en vivo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F2FBF8 0%, #E3F2FD 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og no usa next/image */}
        <img
          src={`${SITE_URL}/brand/aparkeo-logo.png`}
          alt="Aparkeo"
          style={{ width: 880, height: 'auto' }}
        />
        <div
          style={{
            display: 'flex',
            marginTop: 48,
            fontSize: 30,
            fontWeight: 600,
            color: '#0D4E6E',
            letterSpacing: 0.5,
          }}
        >
          Mapa · Predicciones · Reportes de la comunidad
        </div>
      </div>
    ),
    size,
  );
}
