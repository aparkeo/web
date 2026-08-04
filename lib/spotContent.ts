import { z } from 'zod';

/**
 * Validación y constantes del contenido de comunidad en plazas
 * (fotos + comentarios, roadmap nº9). Compartido entre las API routes y los
 * tests unitarios.
 */

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

export const COMMENT_MAX_LENGTH = 500;

/**
 * Cuerpo de un comentario: se hace trim ANTES de validar longitud, así que
 * un texto de solo espacios queda vacío y se rechaza con min(1). Máx 500
 * caracteres (casa con la columna VarChar(500) de spot_comments).
 */
export const commentBodySchema = z
  .string({ required_error: 'El comentario no puede estar vacío' })
  .trim()
  .min(1, 'El comentario no puede estar vacío')
  .max(COMMENT_MAX_LENGTH, `El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres`);

export const createCommentSchema = z.object({
  body: commentBodySchema,
});

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB (límite del bucket)

export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoMime = (typeof PHOTO_ALLOWED_MIME)[number];

export const PHOTO_EXTENSION: Record<PhotoMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isAllowedPhotoMime(mime: string): mime is PhotoMime {
  return (PHOTO_ALLOWED_MIME as readonly string[]).includes(mime);
}

// ---------------------------------------------------------------------------
// Moderación (PATCH hidden)
// ---------------------------------------------------------------------------

export const moderationSchema = z.object({
  hidden: z.boolean(),
});

// ---------------------------------------------------------------------------
// Rate limits (por usuario autenticado, no por IP: son acciones de cuenta)
// ---------------------------------------------------------------------------

export const PHOTOS_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5/hora
export const COMMENTS_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }; // 10/hora

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SpotPhotoDTO {
  id: string;
  url: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface SpotCommentDTO {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}
