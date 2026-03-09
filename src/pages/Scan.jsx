import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  Cpu, HardDrive, MemoryStick, Monitor as MonitorIcon,
  CircuitBoard, ScanLine, Loader2, RefreshCw, ArrowRight,
} from "lucide-react";
import useStore from "../store/useStore";
import { createDefaultProfile, hardwareToComputer } from "../lib/schema";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3 },
};

export default function Scan() {
  const { hardwareScan, setHardwareScan, profileData, setProfileData, setStep } = useStore();
  const [scanning, setScanning] = useState(!hardwareScan);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hardwareScan) runScan();
  }, []);

  const runScan = async () => {
    setScanning(true);
    setError("");
    try {
      const hw = await invoke("scan_hardware");
      setHardwareScan(hw);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleContinue = () => {
    if (hardwareScan) {
      const username = profileData?.username || "";
      const existing = profileData || createDefaultProfile(username);
      const comp = hardwareToComputer(hardwareScan, existing.computers?.[0]?.id);
      setProfileData({
        ...existing,
        computers: [comp, ...(existing.computers || []).slice(1)],
      });
    }
    setStep("edit");
  };

  if (scanning) {
    return (
      <motion.div {...fade} className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-[var(--border)] flex items-center justify-center">
            <ScanLine size={24} className="text-[var(--accent)] animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">Scanning hardware…</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Detecting CPU, GPU, RAM, storage, and more</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div {...fade} className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={runScan} className="btn-secondary text-xs">
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      </motion.div>
    );
  }

  const hw = hardwareScan;
  if (!hw) return null;

  return (
    <motion.div {...fade} className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
            <ScanLine size={22} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Hardware Detected</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Found on <span className="text-[var(--text-secondary)] font-medium">{hw.hostname}</span>. Fix anything in the next step.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <SpecCard
            icon={Cpu}
            title="CPU"
            value={hw.cpu.full_name || "Not detected"}
            sub={hw.cpu.cores > 0 ? `${hw.cpu.cores}C / ${hw.cpu.threads}T` : ""}
          />
          {(hw.gpus || []).map((g, i) => (
            <SpecCard
              key={`gpu-${i}`}
              icon={MonitorIcon}
              title="GPU"
              value={`${g.brand} ${g.model}`.trim() || "Not detected"}
              sub={g.vram_gb > 0 ? `${g.vram_gb} GB VRAM` : ""}
            />
          ))}
          <SpecCard
            icon={MemoryStick}
            title="RAM"
            value={`${Math.round(hw.ram_total_gb)} GB`}
            sub={
              hw.ram_modules?.length > 0
                ? `${hw.ram_modules.length} module${hw.ram_modules.length !== 1 ? "s" : ""} · ${hw.ram_modules[0]?.ram_type || ""}`
                : ""
            }
          />
          <SpecCard
            icon={CircuitBoard}
            title="Motherboard"
            value={`${hw.motherboard?.brand || ""} ${hw.motherboard?.model || ""}`.trim() || "Not detected"}
          />
          {(hw.storage || []).map((s, i) => (
            <SpecCard
              key={`stor-${i}`}
              icon={HardDrive}
              title="Storage"
              value={`${Math.round(s.capacity_gb)} GB`}
              sub={`${s.kind} · ${s.name}`}
            />
          ))}
          <SpecCard
            icon={MonitorIcon}
            title="OS"
            value={hw.os?.name || "Unknown"}
            sub={[hw.os?.version, hw.os?.desktop_environment].filter(Boolean).join(" · ")}
          />
          {(hw.monitors || []).map((m, i) => (
            <SpecCard
              key={`mon-${i}`}
              icon={MonitorIcon}
              title="Monitor"
              value={m.name || "Display"}
              sub={`${m.width}×${m.height} @ ${m.refresh_rate_hz}Hz`}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button onClick={handleContinue} className="btn-primary px-8 py-3 text-sm">
            Continue to Edit
            <ArrowRight size={14} />
          </button>
          <button onClick={runScan} className="btn-ghost text-xs">
            <RefreshCw size={12} /> Re-scan
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SpecCard({ icon: Icon, title, value, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-[var(--text-muted)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{title}</p>
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{value}</p>
          {sub && <p className="text-[0.625rem] text-[var(--text-muted)] truncate mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
