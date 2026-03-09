import { ScanLine, Pencil, Send, Upload, Check } from "lucide-react";
import useStore from "../store/useStore";

export default function Stepper({ currentStep }) {
  const sessionEndpoint = useStore((s) => s.sessionEndpoint);

  const steps = [
    { id: "scan", label: "Scan", icon: ScanLine },
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "submit", label: sessionEndpoint ? "Send" : "Submit", icon: sessionEndpoint ? Upload : Send },
  ];

  const stepIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-0 py-2.5 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] select-none flex-shrink-0">
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isComplete = i < stepIdx;
        const Icon = isComplete ? Check : step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-10 h-px mx-1 transition-colors ${
                  isComplete || isActive
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6875rem] font-medium transition-all ${
                isActive
                  ? "text-[var(--text-primary)] bg-white/[0.07]"
                  : isComplete
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Icon size={12} strokeWidth={isActive ? 2 : 1.5} />
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
