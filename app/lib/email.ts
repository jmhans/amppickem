import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are not configured');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

/** Emails a generated picks xlsx to the commissioner, as a bridge until they accept picks in-app. */
export async function sendPicksEmailToCommissioner(opts: {
  participantName: string;
  participantEmail: string | null;
  seasonYear: number;
  week: number;
  attachmentFilename: string;
  attachmentBuffer: Buffer;
}) {
  const commissionerEmail = process.env.COMMISSIONER_EMAIL;
  if (!commissionerEmail) throw new Error('COMMISSIONER_EMAIL is not configured');

  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to: commissionerEmail,
    cc: opts.participantEmail ?? undefined,
    replyTo: opts.participantEmail ?? undefined,
    subject: `NFL Picks — ${opts.seasonYear} Week ${opts.week} — ${opts.participantName}`,
    text: `${opts.participantName}'s picks for Week ${opts.week} are attached.\n\nSent from AMP Pick'em.`,
    attachments: [
      {
        filename: opts.attachmentFilename,
        content: opts.attachmentBuffer,
      },
    ],
  });
}

/** Nudge email for a participant still short of their weekly pick count — see app/lib/reminders.ts. */
export async function sendPickReminderEmail(opts: {
  participantEmail: string;
  participantName: string;
  week: number;
  pickCount: number;
  picksPerWeek: number;
  picksUrl: string;
}) {
  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to: opts.participantEmail,
    subject: `Reminder: Week ${opts.week} picks (${opts.pickCount}/${opts.picksPerWeek})`,
    text: `Hi ${opts.participantName},\n\nYou've made ${opts.pickCount} of ${opts.picksPerWeek} picks for Week ${opts.week}. Make sure to finish before games start:\n${opts.picksUrl}\n\nSent from AMP Pick'em. You can turn these reminders off from your picks page.`,
  });
}
