import type { Metadata } from "next";
import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { SignOutButton } from "@/components/account/SignOutButton";

export const metadata: Metadata = {
  title: "Admin — Dance Teacher Expo 2027",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getAdminGate();

  if (gate.status !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 text-center">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
              Dance Teacher Expo 2027
            </span>
            <h1 className="display mt-1 text-[clamp(1.8rem,6vw,2.6rem)]">
              Admin
            </h1>
          </div>
          {gate.status === "anon" ? (
            <AdminLoginForm />
          ) : (
            <div className="rounded-[14px] border border-black/10 bg-white p-6 text-center">
              <p className="font-bold text-ink">This account isn&apos;t an admin</p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-ink/65">
                {gate.email} doesn&apos;t have admin access. Sign in with an
                authorised account.
              </p>
              <div className="mt-4">
                <SignOutButton />
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-[min(1140px,94vw)] items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-[5px] bg-pink" />
              <span className="text-[0.9rem] font-extrabold uppercase tracking-[0.1em]">
                DTE Admin
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-[0.82rem] font-bold uppercase tracking-[0.06em] text-ink/60">
              <Link href="/admin" className="hover:text-ink">
                Orders
              </Link>
              <Link href="/admin/comp" className="hover:text-ink">
                Comp
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className="hidden text-[0.78rem] text-ink/50 sm:inline">
              {gate.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-[min(1140px,94vw)] py-[clamp(1.5rem,4vw,2.5rem)]">
        {children}
      </main>
    </div>
  );
}
