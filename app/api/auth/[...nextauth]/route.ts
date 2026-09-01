import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { rejectThrottledCredentialsLogin } from '@/lib/authLoginLimit';

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const blocked = await rejectThrottledCredentialsLogin(req);
  if (blocked) return blocked;
  return handlers.POST(req);
}
