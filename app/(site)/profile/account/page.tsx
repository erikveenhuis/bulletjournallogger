import { getEffectiveUser, getEffectiveSupabaseClient, getEffectiveAdminStatus, isImpersonating } from "@/lib/auth";
import AccountForm from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <a href="/sign-in" className="underline">sign in</a> to manage your account.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_tier, is_admin")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  const accountTier = profile?.account_tier ?? 0;
  const isCurrentlyImpersonating = await isImpersonating();
  const isAdmin = profile?.is_admin || (!isCurrentlyImpersonating && (await getEffectiveAdminStatus()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">Account</h1>
          <p className="text-sm text-gray-700">
            {isAdmin
              ? "Admin accounts have access to all tiers."
              : "Upgrade to unlock custom questions and answer combinations."}
          </p>
        </div>
      </div>

      <AccountForm accountTier={accountTier} />
    </div>
  );
}
