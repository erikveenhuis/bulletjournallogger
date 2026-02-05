import { getEffectiveUser, getEffectiveSupabaseClient, getEffectiveAdminStatus, isImpersonating } from "@/lib/auth";
import { getThemeDefaults } from "@/lib/theme-defaults";
import ThemeForm from "../theme-form";

export const dynamic = "force-dynamic";

export default async function DisplayPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <a href="/sign-in" className="underline">sign in</a> to customize your display.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  const themeDefaults = await getThemeDefaults();
  const accountTier = profile?.account_tier ?? 0;
  const isCurrentlyImpersonating = await isImpersonating();
  const isAdmin = profile?.is_admin || (!isCurrentlyImpersonating && (await getEffectiveAdminStatus()));
  const effectiveTier = isAdmin ? 4 : accountTier;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">Display</h1>
          <p className="text-sm text-gray-700">
            Customize the appearance of your charts and data visualizations.
          </p>
        </div>
      </div>

      {effectiveTier >= 2 ? (
        <ThemeForm
          profile={profile}
          defaultPaletteOverride={themeDefaults.chart_palette}
          defaultStyleOverride={themeDefaults.chart_style}
        />
      ) : (
        <div className="rounded-lg border border-[var(--bujo-border)] bg-white p-4 text-sm text-gray-700">
          <a href="/profile/account" className="underline">Upgrade your account</a> to unlock display customization.
        </div>
      )}
    </div>
  );
}
