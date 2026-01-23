"use client";

import { useEffect, useRef } from "react";
import { ensureSubscriptionActive, registerServiceWorker } from "@/lib/push-subscription";

/**
 * Global push subscription manager component
 * 
 * This component runs on every page load to:
 * - Register service worker globally
 * - Check if user has push enabled in their profile
 * - Automatically renew subscriptions if they've expired
 * - Keep subscriptions active without user interaction
 */
export default function PushManager() {
  const hasCheckedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    let cancelled = false;

    const checkAndRenewSubscription = async () => {
      if (cancelled) return;

      try {
        // First, check if user has push enabled in their profile
        // This avoids unnecessary work for users who don't have push enabled
        let userHasPushEnabled = false;
        try {
          const profileResponse = await fetch("/api/profile");
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            userHasPushEnabled = profile?.push_opt_in === true;
          }
        } catch {
          // If profile check fails, continue anyway - might be unauthenticated user
          // In that case, ensureSubscriptionActive will handle it gracefully
        }

        // Only proceed if user has push enabled in profile OR if we couldn't check profile
        // (in case of unauthenticated users, ensureSubscriptionActive will handle gracefully)
        if (!userHasPushEnabled) {
          // User doesn't have push enabled, skip renewal
          return;
        }

        // Ensure service worker is registered
        await registerServiceWorker();

        // Check and renew subscription if needed
        const result = await ensureSubscriptionActive();

        if (result.active && result.renewed) {
          console.log("Push subscription renewed successfully");
        } else if (!result.active && result.error) {
          // Silently fail - user might not have push enabled or permission denied
          // Only log if it's an unexpected error
          if (result.error !== "Permission not granted" && result.error !== "Push not supported") {
            console.warn("Push subscription check failed:", result.error);
          }
        }
      } catch (error) {
        // Silently handle errors - don't interrupt user experience
        console.warn("Push manager error:", error);
      }
    };

    // Initial check after a short delay to avoid blocking page load
    const initialTimeout = setTimeout(() => {
      if (!cancelled) {
        checkAndRenewSubscription();
        hasCheckedRef.current = true;
      }
    }, 2000);

    // Set up periodic checks (every 5 minutes) to keep subscriptions fresh
    // This ensures subscriptions are renewed even if they expire
    checkIntervalRef.current = setInterval(() => {
      if (!cancelled && hasCheckedRef.current) {
        checkAndRenewSubscription();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Also check when page becomes visible again (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && !cancelled && hasCheckedRef.current) {
        checkAndRenewSubscription();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check when page regains focus
    const handleFocus = () => {
      if (!cancelled && hasCheckedRef.current) {
        checkAndRenewSubscription();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
