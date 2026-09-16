import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireCanEditParticipant, getPicksExportData } from '@/app/lib/actions';
import { generatePicksWorkbook, buildExportFilename } from '@/app/lib/xlsx-export';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const participantId = Number(searchParams.get('participantId'));
  const week = Number(searchParams.get('week'));
  if (!participantId || !week) {
    return NextResponse.json({ error: 'participantId and week are required' }, { status: 400 });
  }

  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === 'Not logged in' ? 401 : 403 });
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  try {
    const { participant, exportGames } = await getPicksExportData(participantId, activeSeason.id, week);
    const buffer = await generatePicksWorkbook(activeSeason.id, activeSeason.year, week, exportGames);
    const filename = buildExportFilename(activeSeason.year, week, participant.name);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate picks export:', error);
    return NextResponse.json({ error: 'Failed to generate picks export' }, { status: 500 });
  }
}
