"use client";

import { useState } from "react";

type Props = {
  steps: string[];
  onChange: (steps: string[]) => void;
  minItems?: number;
  label?: string;
  helperText?: string;
};

export default function StepListEditor({
  steps,
  onChange,
  minItems = 2,
  label = "Steps",
  helperText = "Add options and drag to reorder.",
}: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const updateStep = (index: number, value: string) => {
    const next = [...steps];
    next[index] = value;
    onChange(next);
  };

  const addStep = () => {
    onChange([...steps, ""]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= minItems) return;
    const next = steps.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--bujo-ink)]">{label}</label>
        <button type="button" onClick={addStep} className="bujo-btn-secondary text-xs">
          Add step
        </button>
      </div>
      <p className="text-xs text-[var(--bujo-subtle)]">{helperText}</p>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={`step-${index}`}
            className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] px-2 py-1"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              setDraggingIndex(index);
            }}
            onDragEnd={() => setDraggingIndex(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingIndex === null) return;
              moveStep(draggingIndex, index);
              setDraggingIndex(null);
            }}
          >
            <span className="select-none text-xs font-semibold text-[var(--bujo-subtle)]">≡</span>
            <input
              value={step}
              onChange={(event) => updateStep(index, event.target.value)}
              className="bujo-input flex-1"
              placeholder={`Option ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeStep(index)}
              className="bujo-btn-danger text-xs"
              disabled={steps.length <= minItems}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {steps.length < minItems && (
        <p className="text-xs text-red-600">Add at least {minItems} options.</p>
      )}
    </div>
  );
}
