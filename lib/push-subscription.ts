/**
 * Centralized push subscription management utilities
 * Handles service worker registration, subscription creation/renewal, and validation
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export interface PushSubscriptionResult {
  success: boolean;
  subscription?: PushSubscriptionJSON;
  error?: string;
}

/**
 * Converts VAPID public key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker and ensures it's ready
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await registration.update(); // Check for updates
    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

/**
 * Gets the current push subscription if it exists
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return null;
    }
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error("Failed to get subscription:", error);
    return null;
  }
}

/**
 * Creates or renews a push subscription
 */
export async function subscribeToPush(): Promise<PushSubscriptionResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Not in browser environment" };
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, error: "Push not supported in this browser" };
  }

  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: "Missing VAPID public key" };
  }

  try {
    // Check notification permission
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return { success: false, error: "Push permission not granted" };
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: "Failed to register service worker" };
    }

    // Wait for service worker to be ready
    await registration.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // If subscription exists, check if it's still valid
    if (subscription) {
      try {
        // Try to get subscription details to validate it
        const subJson = subscription.toJSON();
        if (subJson.endpoint && subJson.keys) {
          // Subscription appears valid, return it
          return { success: true, subscription: subJson };
        }
      } catch (error) {
        // Subscription might be invalid, unsubscribe and create new one
        console.warn("Existing subscription appears invalid, creating new one:", error);
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    // Create new subscription if none exists
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = subscription.toJSON();
    return { success: true, subscription: subJson };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to subscribe to push:", error);
    return { success: false, error: message };
  }
}

/**
 * Saves subscription to the server
 */
export async function saveSubscriptionToServer(
  subscription: PushSubscriptionJSON,
): Promise<boolean> {
  try {
    const response = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
        ua: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error("Failed to save subscription:", data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving subscription to server:", error);
    return false;
  }
}

/**
 * Unsubscribes from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    return true;
  } catch (error) {
    console.error("Failed to unsubscribe:", error);
    return false;
  }
}

/**
 * Checks if push notifications are supported and enabled
 */
export async function checkPushSupport(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const permission = typeof window !== "undefined" ? Notification.permission : "denied";
  const subscription = await getCurrentSubscription();

  return {
    supported,
    permission,
    subscribed: !!subscription,
  };
}

/**
 * Validates and renews subscription if needed
 * This is the main function to call periodically to keep subscriptions alive
 */
export async function ensureSubscriptionActive(): Promise<{
  active: boolean;
  renewed: boolean;
  error?: string;
}> {
  const support = await checkPushSupport();
  
  if (!support.supported) {
    return { active: false, renewed: false, error: "Push not supported" };
  }

  if (support.permission !== "granted") {
    return { active: false, renewed: false, error: "Permission not granted" };
  }

  try {
    // Try to get existing subscription
    const existing = await getCurrentSubscription();
    
    if (existing) {
      // Validate existing subscription
      try {
        const subJson = existing.toJSON();
        if (subJson.endpoint && subJson.keys) {
          // Subscription exists and appears valid
          return { active: true, renewed: false };
        }
      } catch (error) {
        // Subscription is invalid, need to renew
        console.warn("Subscription validation failed, renewing:", error);
      }
    }

    // No subscription or invalid subscription - create/renew
    const result = await subscribeToPush();
    
    if (!result.success || !result.subscription) {
      return { active: false, renewed: false, error: result.error };
    }

    // Save to server
    const saved = await saveSubscriptionToServer(result.subscription);
    if (!saved) {
      return { active: false, renewed: false, error: "Failed to save subscription" };
    }

    return { active: true, renewed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { active: false, renewed: false, error: message };
  }
}
