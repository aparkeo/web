import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="container max-w-5xl flex-1 py-8">{children}</div>
    </div>
  );
}
