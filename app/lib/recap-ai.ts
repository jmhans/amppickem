// Plain module (no 'use server') — the actual LLM call for the AI-drafted recap (see
// generateRecapDraft in actions.ts). Kept separate from recap-stats.ts so "gather the facts"
// and "turn facts into prose" stay independently testable/replaceable.
//
// Uses Gemini (Google AI Studio's free tier) rather than a paid API — this is a once-a-week,
// tiny-prompt call, well within free-tier limits, and doesn't need Claude-level capability
// just to turn a short fact sheet into a few paragraphs of prose.
import { GoogleGenAI } from '@google/genai';
import type { RecapWeekStats } from '@/app/lib/recap-stats';

const MODEL = 'gemini-2.5-flash';

/**
 * Turns computed stats into a plain-language fact sheet for the model — all the arithmetic
 * (margins, counts, "who") is already done in recap-stats.ts, so the model's only job is
 * prose, not math. A category with no facts is omitted entirely rather than left for the
 * model to pad out.
 */
function formatStatsForPrompt(stats: RecapWeekStats): string {
  const lines: string[] = [`Week ${stats.week} — ${stats.gamesConsidered} games final.`];

  lines.push('');
  lines.push(
    stats.weeklyWinnerNames.length > 0
      ? `Weekly winner(s) (best record this week, i.e. the "skins" winner): ${stats.weeklyWinnerNames.join(', ')}.`
      : 'No sole weekly winner this week (tie for best record, so no skin was awarded) — do not name anyone as "the" winner.',
  );

  if (stats.upsets.length > 0) {
    lines.push('', 'Biggest upsets (underdog won the game outright):');
    for (const u of stats.upsets) {
      lines.push(`- ${u.winner} won outright as a ${u.dogPoints}-point underdog (${u.matchup}).`);
    }
  }

  if (stats.lineBlowouts.length > 0) {
    lines.push('', 'Results that blew way past the posted line:');
    for (const b of stats.lineBlowouts) {
      lines.push(`- ${b.description}.`);
    }
  }

  if (stats.lopsidedPicks.length > 0) {
    lines.push('', 'Pool picks that went badly for the crowd:');
    for (const l of stats.lopsidedPicks) {
      const what = l.pickType === 'spread' ? 'the spread' : 'the total';
      lines.push(`- ${l.losingCount} of ${l.totalPicks} entries who picked ${what} on ${l.matchup} took ${l.losingSideLabel}, and lost.`);
    }
  }

  if (stats.contrarianWins.length > 0) {
    lines.push('', 'Pool picks where almost nobody had it, and they were right:');
    for (const c of stats.contrarianWins) {
      lines.push(`- Only ${c.winningCount} of ${c.totalPicks} entries took ${c.winningSideLabel} on ${c.matchup} (${c.winnerNames.join(', ')}), and it hit.`);
    }
  }

  return lines.join('\n');
}

const SYSTEM_INSTRUCTION =
  'You write a short, fun weekly recap for a friends\' NFL spread pick\'em pool. Casual and a little playful, ' +
  'never mean-spirited about anyone\'s picks. Use ONLY the facts given — never invent scores, teams, lines, or ' +
  'names that are not in the fact sheet, and never state a number that was not given to you. If a category has ' +
  'no facts listed, skip it entirely rather than inventing something to fill the gap. Write in plain paragraphs ' +
  '(a blank line between paragraphs) — no markdown headers, bullet points, or bold text. Keep it to 3-5 short ' +
  'paragraphs. Respond with ONLY a JSON object shaped {"title": string, "body": string} and nothing else — no ' +
  'code fences, no explanation before or after it.';

/** Throws on any failure (missing key, bad response, etc.) — caller (generateRecapDraft) turns that into a user-facing error string. */
export async function generateRecapText(stats: RecapWeekStats): Promise<{ title: string; body: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const client = new GoogleGenAI({ apiKey });
  const factSheet = formatStatsForPrompt(stats);

  const response = await client.models.generateContent({
    model: MODEL,
    contents: `Here are this week's facts:\n\n${factSheet}\n\nWrite the recap.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) throw new Error('No text response from model');

  let parsed: { title?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string' || !parsed.title || !parsed.body) {
    throw new Error('Model response was missing a title or body');
  }

  return { title: parsed.title, body: parsed.body };
}
