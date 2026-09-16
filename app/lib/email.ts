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
