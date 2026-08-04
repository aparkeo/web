import { describe, expect, it } from 'vitest';
import { COMMENT_MAX_LENGTH, commentBodySchema, createCommentSchema, moderationSchema } from '@/lib/spotContent';

describe('commentBodySchema — validación de comentarios', () => {
  it('acepta un comentario normal', () => {
    const result = commentBodySchema.safeParse('Suele estar libre por las mañanas');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Suele estar libre por las mañanas');
  });

  it('hace trim de espacios en los extremos', () => {
    const result = commentBodySchema.safeParse('   Plaza amplia y bien señalizada   ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Plaza amplia y bien señalizada');
  });

  it('rechaza una cadena vacía', () => {
    expect(commentBodySchema.safeParse('').success).toBe(false);
  });

  it('rechaza un texto de solo espacios (tras el trim queda vacío)', () => {
    expect(commentBodySchema.safeParse('     ').success).toBe(false);
    expect(commentBodySchema.safeParse('\n\t  \n').success).toBe(false);
  });

  it(`acepta exactamente ${COMMENT_MAX_LENGTH} caracteres`, () => {
    expect(commentBodySchema.safeParse('a'.repeat(COMMENT_MAX_LENGTH)).success).toBe(true);
  });

  it(`rechaza más de ${COMMENT_MAX_LENGTH} caracteres`, () => {
    expect(commentBodySchema.safeParse('a'.repeat(COMMENT_MAX_LENGTH + 1)).success).toBe(false);
  });

  it('el trim se aplica antes del límite de longitud', () => {
    // 500 chars de contenido + espacios alrededor → válido tras trim.
    const result = commentBodySchema.safeParse(`  ${'b'.repeat(COMMENT_MAX_LENGTH)}  `);
    expect(result.success).toBe(true);
  });

  it('rechaza tipos que no son string', () => {
    expect(commentBodySchema.safeParse(undefined).success).toBe(false);
    expect(commentBodySchema.safeParse(null).success).toBe(false);
    expect(commentBodySchema.safeParse(42).success).toBe(false);
  });

  it('conserva intacto el HTML (React lo escapa al renderizar)', () => {
    const html = '<script>alert("xss")</script>';
    const result = commentBodySchema.safeParse(html);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(html);
  });
});

describe('createCommentSchema — envoltura del body', () => {
  it('acepta { body } válido', () => {
    expect(createCommentSchema.safeParse({ body: 'hola' }).success).toBe(true);
  });

  it('rechaza sin body o con body inválido', () => {
    expect(createCommentSchema.safeParse({}).success).toBe(false);
    expect(createCommentSchema.safeParse({ body: '  ' }).success).toBe(false);
  });
});

describe('moderationSchema — PATCH hidden', () => {
  it('acepta booleanos', () => {
    expect(moderationSchema.safeParse({ hidden: true }).success).toBe(true);
    expect(moderationSchema.safeParse({ hidden: false }).success).toBe(true);
  });

  it('rechaza no booleanos', () => {
    expect(moderationSchema.safeParse({ hidden: 'true' }).success).toBe(false);
    expect(moderationSchema.safeParse({}).success).toBe(false);
  });
});
