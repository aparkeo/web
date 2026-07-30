import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { StatsSummary } from '@/types';

export async function GET() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalSpots, free, occupied, totalReports, reportsLast24h, activeUsers] = await Promise.all([
    prisma.parkingSpot.count(),
    prisma.parkingSpot.count({ where: { status: 'FREE' } }),
    prisma.parkingSpot.count({ where: { status: 'OCCUPIED' } }),
    prisma.report.count(),
    prisma.report.count({ where: { reportedAt: { gte: since24h } } }),
    prisma.report.groupBy({ by: ['userId'], where: { reportedAt: { gte: since24h } } }).then((g) => g.length),
  ]);

  const summary: StatsSummary = {
    totalSpots,
    free,
    occupied,
    unknown: totalSpots - free - occupied,
    totalReports,
    reportsLast24h,
    activeUsers,
  };

  return NextResponse.json(summary);
}
