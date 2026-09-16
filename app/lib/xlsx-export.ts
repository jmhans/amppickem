import path from 'path';
import ExcelJS from 'exceljs';
import { teamFullName } from '@/app/lib/team-names';
import { getWeekTemplateBuffer, type PicksExportGame } from '@/app/lib/actions';
import { FIRST_GAME_ROW, LAST_GAME_ROW, MAX_GAMES } from '@/app/lib/template-layout';

const TEMPLATE_PATH = path.join(process.cwd(), 'app/lib/templates/pickem-template.xlsx');

function formatGameTime(d: Date | null): string {
  if (!d) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  return `${day}, ${time} CT`;
}

/** Builds the commissioner-format xlsx for one participant's week from that week's template. */
export async function generatePicksWorkbook(
  seasonId: number,
  seasonYear: number,
  week: number,
  weekGames: PicksExportGame[],
): Promise<Buffer> {
  if (weekGames.length > MAX_GAMES) {
    throw new Error(`Too many games for the template (${weekGames.length} > ${MAX_GAMES})`);
  }

  const wb = new ExcelJS.Workbook();
  // Admins can upload that week's own commissioner spreadsheet (game order/quips/etc. vary
  // week to week) — see actions.ts's uploadWeekTemplate(). Falls back to the static default
  // template for any week nobody's uploaded one for yet.
  const customTemplate = await getWeekTemplateBuffer(seasonId, week);
  if (customTemplate) {
    // exceljs's bundled ambient Buffer type conflicts with @types/node's newer generic
    // Buffer<T> via global declaration merging — structurally fine at runtime, so `any` here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(customTemplate as any);
  } else {
    await wb.xlsx.readFile(TEMPLATE_PATH);
  }
  const sheet = wb.getWorksheet('Sheet1');
  if (!sheet) throw new Error('Template is missing Sheet1');

  // The template has a leftover defined name ("team_map_no_initials") pointing at an
  // EXTERNAL workbook reference (e.g. '[1]TeamMap'!...) from the commissioner's own tooling —
  // unused by anything we generate. exceljs doesn't round-trip the external-link machinery
  // that backs it (xl/externalLinks/*, the <externalReferences> element) on write, but leaves
  // the dangling "[1]" token in the defined name itself. That mismatch is exactly what made
  // Excel flag the emailed file as needing repair. Strip any defined name that still
  // references an external workbook before writing.
  wb.definedNames.model = wb.definedNames.model.filter((dn) => !dn.ranges.some((r) => r.includes('[')));

  sheet.getCell('B4').value = `${seasonYear} NFL Season: Week ${week}`;

  weekGames.forEach((g, i) => {
    const row = FIRST_GAME_ROW + i;
    sheet.getCell(`B${row}`).value = formatGameTime(g.gameTime);
    sheet.getCell(`E${row}`).value = teamFullName(g.awayTeam);
    sheet.getCell(`F${row}`).value = '@';
    sheet.getCell(`G${row}`).value = teamFullName(g.homeTeam);
    sheet.getCell(`H${row}`).value = g.spread;
    sheet.getCell(`I${row}`).value = g.overUnder;

    sheet.getCell(`K${row}`).value = g.spreadSelection === 'away' ? 'X' : null;
    sheet.getCell(`L${row}`).value = g.spreadSelection === 'home' ? 'X' : null;
    sheet.getCell(`M${row}`).value = g.overUnderSelection === 'under' ? 'X' : null;
    sheet.getCell(`N${row}`).value = g.overUnderSelection === 'over' ? 'X' : null;
  });

  // Any template rows past this week's real games must stay fully blank — the
  // template's O-column "Error!" check fires if a pick mark exists on a blank row.
  for (let row = FIRST_GAME_ROW + weekGames.length; row <= LAST_GAME_ROW; row++) {
    for (const col of ['B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N']) {
      sheet.getCell(`${col}${row}`).value = null;
    }
  }

  // exceljs writes formulas verbatim but doesn't evaluate them — without this,
  // Excel opens the file showing whatever cached results the blank template had
  // (the win/push legend and "N Picks Left" counter) until the user forces a recalc.
  wb.calcProperties.fullCalcOnLoad = true;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** e.g. "NFL Picks-2026 Week 01-Justin Hanson.xlsx", matching the commissioner's own naming. */
export function buildExportFilename(seasonYear: number, week: number, participantName: string): string {
  const weekStr = String(week).padStart(2, '0');
  return `NFL Picks-${seasonYear} Week ${weekStr}-${participantName}.xlsx`;
}
