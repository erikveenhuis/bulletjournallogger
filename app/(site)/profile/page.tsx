import { getEffectiveUser, getEffectiveAdminStatus, isImpersonating } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> to manage your profile.
      </div>
    );
  }

  const isCurrentlyImpersonating = await isImpersonating();
  const isAdmin = !isCurrentlyImpersonating && (await getEffectiveAdminStatus());

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-700">
            Configure your reminders and daily questions.
          </p>
        </div>
        <Link
          href="/journal"
          className="bujo-btn w-full justify-center text-sm sm:w-auto"
        >
          Go to today&apos;s questions
        </Link>
      </div>

      <div className="bujo-card bujo-torn">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Choose a section</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/profile/reminders"
              className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[var(--bujo-accent-ink)] hover:bg-[var(--bujo-accent)]/5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bujo-accent)]/10 text-[var(--bujo-accent-ink)]">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reminders</h3>
                  <p className="text-sm text-gray-600">
                    Set your timezone, reminder time, and notification preferences.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/profile/questions"
              className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[var(--bujo-accent-ink)] hover:bg-[var(--bujo-accent)]/5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bujo-accent)]/10 text-[var(--bujo-accent-ink)]">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">My questions</h3>
                  <p className="text-sm text-gray-600">
                    Browse templates and customize your daily questions.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/profile/theme"
              className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[var(--bujo-accent-ink)] hover:bg-[var(--bujo-accent)]/5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bujo-accent)]/10 text-[var(--bujo-accent-ink)]">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Theme</h3>
                  <p className="text-sm text-gray-600">
                    Customize chart colors and visualization styles.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/profile/account"
              className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[var(--bujo-accent-ink)] hover:bg-[var(--bujo-accent)]/5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bujo-accent)]/10 text-[var(--bujo-accent-ink)]">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 017 21h10a4 4 0 001.879-3.196M12 3v4m0 0l3-3m-3 3L9 4m8 4a4 4 0 01-4 4H9a4 4 0 01-4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Account</h3>
                  <p className="text-sm text-gray-600">
                    {isAdmin ? "Manage account access." : "Upgrade or downgrade your account access."}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
