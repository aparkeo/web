import { ImageResponse } from 'next/og';
import { OG_LOGO_BASE64 } from './og-logo-data';

// Tarjeta OG de marca (1200×630): la primera impresión al pegar el enlace en
// WhatsApp, X o Telegram. SVG no vale: esas plataformas exigen PNG/JPG.
// El logo viaja en base64 dentro del bundle: una URL absoluta rompe la build
// ("Can't load image") y leer de public/ rompe el runtime serverless de
// Vercel (ENOENT: public/ no se copia a la función).
const logoSrc = `data:image/png;base64,${OG_LOGO_BASE64}`;

export const runtime = 'nodejs';
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
        {/* satori exige ancho y alto explícitos; 'auto' descarta la imagen */}
        <img src={logoSrc} alt="Aparkeo" width={880} height={357} />
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
