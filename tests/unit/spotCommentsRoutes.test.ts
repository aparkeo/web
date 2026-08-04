import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks (hoisted) -------------------------------------------------------

const spotFindUnique = vi.hoisted(() => vi.fn());
const commentFindMany = vi.hoisted(() => vi.fn());
const commentCreate = vi.hoisted(() => vi.fn());
const commentFindUnique = vi.hoisted(() => vi.fn());
const commentDelete = vi.hoisted(() => vi.fn());
const commentUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parkingSpot: { findUnique: spotFindUnique },
    spotComment: {
      findMany: commentFindMany,
      create: commentCreate,
      findUnique: commentFindUnique,
      delete: commentDelete,
      update: commentUpdate,
    },
  },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 9, retryAfterSec: 3600 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { GET, POST } from '@/app/api/spots/[id]/comments/route';
import { DELETE, PATCH } from '@/app/api/spots/[id]/comments/[commentId]/route';

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'USER' };
const MODERATOR = { id: 'mod-1', name: 'Mod', email: 'mod@example.com', role: 'MODERATOR' };

const COMMENT_ROW = {
  id: 'c1',
  spotId: 7,
  userId: 'user-1',
  body: 'Suele estar libre',
  hidden: false,
  createdAt: new Date('2026-08-05T10:00:00Z'),
  user: { name: 'Ana' },
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function childParams(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) };
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/spots/7/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/spots/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commentFindMany.mockResolvedValue([COMMENT_ROW]);
  });

  it('devuelve comentarios visibles con nombre de autor, sin email', async () => {
    const res = await GET(new NextRequest('http://localhost/api/spots/7/comments'), params('7'));
    expect(res.status).toBe(200);
    const where = commentFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ spotId: 7, hidden: false });
    expect(commentFindMany.mock.calls[0][0].take).toBe(50);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: 'c1', body: 'Suele estar libre', authorName: 'Ana', authorId: 'user-1' });
    expect(json[0]).not.toHaveProperty('email');
  });

  it('rechaza un id no numérico', async () => {
    const res = await GET(new NextRequest('http://localhost/api/spots/abc/comments'), params('abc'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/spots/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spotFindUnique.mockResolvedValue({ id: 7 });
    commentCreate.mockResolvedValue(COMMENT_ROW);
  });

  it('401 si no hay sesión', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(postReq({ body: 'hola' }), params('7'));
    expect(res.status).toBe(401);
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('400 si el body son solo espacios', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await POST(postReq({ body: '    ' }), params('7'));
    expect(res.status).toBe(400);
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('400 si supera 500 caracteres', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await POST(postReq({ body: 'a'.repeat(501) }), params('7'));
    expect(res.status).toBe(400);
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('404 si la plaza no existe', async () => {
    authMock.mockResolvedValue({ user: USER });
    spotFindUnique.mockResolvedValue(null);
    const res = await POST(postReq({ body: 'hola' }), params('7'));
    expect(res.status).toBe(404);
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('201 crea el comentario con el body recortado (trim)', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await POST(postReq({ body: '  Suele estar libre  ' }), params('7'));
    expect(res.status).toBe(201);
    expect(commentCreate.mock.calls[0][0].data).toEqual({
      spotId: 7,
      userId: 'user-1',
      body: 'Suele estar libre',
    });
    const json = await res.json();
    expect(json).toMatchObject({ id: 'c1', authorName: 'Ana' });
  });
});

describe('DELETE /api/spots/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commentFindUnique.mockResolvedValue(COMMENT_ROW);
    commentDelete.mockResolvedValue(COMMENT_ROW);
  });

  it('el autor puede borrar su comentario', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'c1'));
    expect(res.status).toBe(200);
    expect(commentDelete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('un usuario ajeno recibe 403', async () => {
    authMock.mockResolvedValue({ user: { ...USER, id: 'otro' } });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'c1'));
    expect(res.status).toBe(403);
    expect(commentDelete).not.toHaveBeenCalled();
  });

  it('un moderador NO puede borrar en firme (debe ocultar con PATCH)', async () => {
    authMock.mockResolvedValue({ user: MODERATOR });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'c1'));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/ocultan/i);
    expect(commentDelete).not.toHaveBeenCalled();
  });

  it('404 si el comentario no existe', async () => {
    authMock.mockResolvedValue({ user: USER });
    commentFindUnique.mockResolvedValue(null);
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'c1'));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/spots/[id]/comments/[commentId] — moderación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commentUpdate.mockResolvedValue({ ...COMMENT_ROW, hidden: true });
  });

  function patchReq(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/spots/7/comments/c1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('un moderador puede ocultar (hidden=true)', async () => {
    authMock.mockResolvedValue({ user: MODERATOR });
    const res = await PATCH(patchReq({ hidden: true }), childParams('7', 'c1'));
    expect(res.status).toBe(200);
    expect(commentUpdate).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { hidden: true } });
  });

  it('un usuario normal recibe 403', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await PATCH(patchReq({ hidden: true }), childParams('7', 'c1'));
    expect(res.status).toBe(403);
    expect(commentUpdate).not.toHaveBeenCalled();
  });

  it('400 si hidden no es booleano', async () => {
    authMock.mockResolvedValue({ user: MODERATOR });
    const res = await PATCH(patchReq({ hidden: 'sí' }), childParams('7', 'c1'));
    expect(res.status).toBe(400);
  });
});
