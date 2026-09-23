import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
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
    <main className="space-y-5">
      <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
        Participants
      </h1>

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
