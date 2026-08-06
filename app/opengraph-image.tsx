import { ImageResponse } from 'next/og';

// Tarjeta OG de marca (1200×630): la primera impresión al pegar el enlace en
// WhatsApp, X o Telegram. SVG no vale: esas plataformas exigen PNG/JPG.
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
          justifyContent: 'center',
          padding: 80,
          background: '#0D776B',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 36,
              background: '#F2FBF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 96,
              fontWeight: 800,
              color: '#0D776B',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 100, fontWeight: 800, color: '#FFFFFF', letterSpacing: -3, lineHeight: 1 }}>
              Aparkeo
            </div>
            <div style={{ fontSize: 42, fontWeight: 600, color: '#CFF2EA', marginTop: 16 }}>
              Plazas PMR en vivo · España
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 72, fontSize: 30, fontWeight: 500, color: '#9FE3D5' }}>
          Mapa · Predicciones · Reportes de la comunidad
        </div>
      </div>
    ),
    size,
  );
}
