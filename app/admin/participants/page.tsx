import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import HomeButton from '@/app/ui/home-button';
import { lusitana } from '@/app/ui/fonts';
import { getParticipants } from '@/app/lib/actions';
import ParticipantsAdmin from './ParticipantsAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminParticipantsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const participants = await getParticipants();

  return (
    <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
      <HomeButton />

      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
        <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
          Participants
        </h1>
      </div>

      <ParticipantsAdmin
        participants={participants.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          auth0Id: p.auth0Id,
          isActive: p.isActive,
        }))}
      />
    </main>
  );
}
