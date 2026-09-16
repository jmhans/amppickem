import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/app/lib/auth0';

// Same pattern as the feedback workflow in fgt2/ABL — logged-in users file a bug/feature
// request that becomes a GitHub issue directly, no separate tracker to check.
const GITHUB_TOKEN = process.env.GITHUB_FEEDBACK_TOKEN;
const REPO_OWNER = 'jmhans';
const REPO_NAME = 'amppickem';
const FEEDBACK_LABEL = 'feedback';
const GITHUB_API = 'https://api.github.com';

// GET /api/feedback — list open issues labelled 'feedback'
export async function GET() {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'Feedback not configured' }, { status: 503 });
  }

  const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=${FEEDBACK_LABEL}&state=open&per_page=50&sort=created&direction=desc`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 502 });
  }

  const issues = await res.json();
  const mapped = (issues as Record<string, unknown>[]).map((issue) => ({
    number: issue.number,
    title: issue.title,
    createdAt: issue.created_at,
    url: issue.html_url,
  }));

  return NextResponse.json(mapped);
}

// POST /api/feedback — create a new issue (requires auth)
export async function POST(request: NextRequest) {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'Feedback not configured' }, { status: 503 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'You must be signed in to submit feedback' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!title || title.length < 5) {
    return NextResponse.json({ error: 'Title must be at least 5 characters' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 });
  }
  if (description.length > 5000) {
    return NextResponse.json({ error: 'Description must be 5000 characters or fewer' }, { status: 400 });
  }

  const userName = session.user.name ?? session.user.email ?? session.user.sub ?? 'Unknown user';
  const issueBody = [
    description || '_No description provided._',
    '',
    '---',
    `*Submitted by: ${userName}*`,
  ].join('\n');

  await ensureFeedbackLabel();

  const createRes = await fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: issueBody, labels: [FEEDBACK_LABEL] }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    console.error('GitHub create issue error', err);
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 502 });
  }

  const created = await createRes.json() as { number: number; title: string; html_url: string; created_at: string };
  return NextResponse.json({
    number: created.number,
    title: created.title,
    url: created.html_url,
    createdAt: created.created_at,
  }, { status: 201 });
}

async function ensureFeedbackLabel() {
  const check = await fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/labels/${FEEDBACK_LABEL}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (check.status === 404) {
    await fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: FEEDBACK_LABEL, color: '0075ca', description: 'User-submitted feedback' }),
    });
  }
}
