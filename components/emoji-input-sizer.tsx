"use client";

import { useEffect } from "react";

const isEmojiOnly = (value: string) => {
  const cleaned = value.replace(/\s+/g, "");
  if (!cleaned) return false;
  return /^[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]+$/u.test(cleaned);
};

const updateEmojiAttribute = (target: EventTarget | null) => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (!target.classList.contains("bujo-input")) {
    return;
  }
  const shouldEnlarge = isEmojiOnly(target.value);
  target.dataset.emojiOnly = shouldEnlarge ? "true" : "false";
};

export default function EmojiInputSizer() {
  useEffect(() => {
    const handler = (event: Event) => updateEmojiAttribute(event.target);
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".bujo-input");
    inputs.forEach((input) => updateEmojiAttribute(input));

    document.addEventListener("input", handler, true);
    document.addEventListener("change", handler, true);

    return () => {
      document.removeEventListener("input", handler, true);
      document.removeEventListener("change", handler, true);
    };
  }, []);

  return null;
}
