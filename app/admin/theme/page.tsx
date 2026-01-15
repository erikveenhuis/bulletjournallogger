import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getThemeDefaults } from "@/lib/theme-defaults";
import ThemeForm from "../../(site)/profile/theme-form";

export const dynamic = "force-dynamic";

export default async function AdminThemePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> as admin.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Admin access required.
      </div>
    );
  }

  const themeDefaults = await getThemeDefaults();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Global theme</h1>
        <p className="text-sm text-gray-600">
          Set the default chart palette and style for new accounts.
        </p>
      </div>

      <ThemeForm
        profile={{
          chart_palette: themeDefaults.chart_palette,
          chart_style: themeDefaults.chart_style,
        }}
        title="Default chart theme"
        description="Applies to new users and to reset actions."
        saveEndpoint="/api/admin/theme-defaults"
      />
    </div>
  );
}
