import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import ProfileForm from "../profile-form";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <a href="/sign-in" className="underline">sign in</a> to manage your reminders.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  const timezoneOptions = [
    "UTC",
    "Europe/Amsterdam",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Singapore",
    "Asia/Tokyo",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-700">
            Configure your timezone, reminder time, and notification preferences.
          </p>
        </div>
      </div>

      <ProfileForm
        profile={profile}
        timezoneOptions={timezoneOptions}
      />
    </div>
  );
}