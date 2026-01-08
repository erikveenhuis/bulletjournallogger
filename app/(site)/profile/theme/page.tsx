import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import ThemeForm from "../theme-form";

export const dynamic = "force-dynamic";

export default async function ThemePage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <a href="/sign-in" className="underline">sign in</a> to customize your theme.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">Theme</h1>
          <p className="text-sm text-gray-700">
            Customize the appearance of your charts and data visualizations.
          </p>
        </div>
      </div>

      <ThemeForm profile={profile} />
    </div>
  );
}