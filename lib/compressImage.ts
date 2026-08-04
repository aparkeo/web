/**
 * Redimensiona/recomprime una imagen en cliente con canvas antes de subirla
 * (roadmap nº9): máximo 1600 px por lado. Fotos de móvil típicas pesan
 * 3-8 MB a 4000+ px; para la web sobran 1600 px y así caben de sobra en el
 * límite de 5 MB del bucket y cargan rápido en la galería.
 *
 * Estrategia conservadora:
 *  - Si la imagen ya es pequeña (≤ 1600 px y ≤ 1,5 MB) se devuelve intacta
 *    para no degradar calidad.
 *  - Al recomprimir se conserva el mime original (jpeg/webp/png; canvas
 *    soporta los tres en los navegadores modernos).
 *  - Cualquier fallo (formato raro, canvas no disponible) → se devuelve el
 *    archivo original: la validación definitiva es siempre server-side.
 */

const MAX_SIDE = 1600;
const SKIP_BYTES = 1.5 * 1024 * 1024;

export async function compressImage(file: File): Promise<File> {
  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      const { width, height } = img;
      if (width <= MAX_SIDE && height <= MAX_SIDE && file.size <= SKIP_BYTES) {
        return file;
      }

      const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const type = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], file.name, { type, lastModified: file.lastModified });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
