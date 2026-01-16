"use client";

import { usePathname, useRouter } from "next/navigation";

const HIDDEN_PATHS = new Set(["/"]);

export default function BackNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="mb-6 flex items-center">
      <button
        type="button"
        className="bujo-btn-secondary"
        onClick={handleBack}
        aria-label="Go back"
      >
        Back
      </button>
    </div>
  );
}
