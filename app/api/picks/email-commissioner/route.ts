import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireCanEditParticipant, getPicksExportData } from '@/app/lib/actions';
import { generatePicksWorkbook, buildExportFilename } from '@/app/lib/xlsx-export';
import { sendPicksEmailToCommissioner } from '@/app/lib/email';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const participantId = Number(body.participantId);
  const week = Number(body.week);
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

    await sendPicksEmailToCommissioner({
      participantName: participant.name,
      participantEmail: participant.email,
      seasonYear: activeSeason.year,
      week,
      attachmentFilename: filename,
      attachmentBuffer: buffer,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to email picks to commissioner:', error);
    const message = error instanceof Error ? error.message : 'Failed to email picks to commissioner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
