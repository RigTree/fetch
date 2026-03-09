import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  Cpu, HardDrive, MemoryStick, Monitor as MonitorIcon,
  CircuitBoard, Smartphone, Plus, Trash2, ChevronDown, ChevronRight,
  Loader2, RefreshCw, User, ArrowLeft, ArrowRight,
} from "lucide-react";
import useStore from "../store/useStore";
import {
  createDefaultProfile, createDefaultComputer, createDefaultGpu,
  createDefaultRam, createDefaultStorage, createDefaultMonitor,
  createDefaultOS, createDefaultPhone, hardwareToComputer,
  COMPUTER_TYPES, COMPUTER_ROLES, RAM_TYPES, STORAGE_TYPES,
  STORAGE_FORM_FACTORS, PSU_EFFICIENCIES, DISPLAY_TYPES,
} from "../lib/schema";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.3 } };

export default function Editor() {
  const { profileData, setProfileData, setStep, hardwareScan, setHardwareScan } = useStore();
  const [data, setData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    if (profileData) {
      setData(profileData);
    } else {
      setData(createDefaultProfile(""));
    }
  }, []);

  const handleRescan = async () => {
    setScanning(true);
    try {
      const hw = await invoke("scan_hardware");
      setHardwareScan(hw);
      setData((prev) => {
        if (!prev) return prev;
        const comp = hardwareToComputer(hw, prev.computers?.[0]?.id);
        const next = { ...prev, computers: [comp, ...(prev.computers || []).slice(1)] };
        setProfileData(next);
        return next;
      });
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  };

  const update = useCallback(
    (fn) => {
      setData((prev) => {
        const next = typeof fn === "function" ? fn(prev) : { ...prev, ...fn };
        setProfileData(next);
        return next;
      });
    },
    [setProfileData]
  );

  if (!data) return null;

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "computers", label: "Computers", icon: Cpu },
    { id: "phones", label: "Phones", icon: Smartphone },
  ];

  return (
    <motion.div {...fade} className="h-full flex flex-col">
      <header className="flex-shrink-0 border-b border-[var(--border-subtle)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("scan")} className="btn-ghost p-1.5" title="Back to Scan">
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2 className="text-base font-bold tracking-tight">Review & Edit</h2>
            <p className="text-[0.65rem] text-[var(--text-muted)]">Fix anything the scan got wrong</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRescan} disabled={scanning} className="btn-secondary text-xs">
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {scanning ? "Scanning…" : "Re-scan"}
          </button>
          <button onClick={() => setStep("submit")} className="btn-primary text-xs">
            Continue
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <div className="flex-shrink-0 border-b border-[var(--border-subtle)] px-6 flex gap-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "profile" && <ProfileSection data={data} update={update} />}
        {activeTab === "computers" && <ComputersSection data={data} update={update} />}
        {activeTab === "phones" && <PhonesSection data={data} update={update} />}
      </div>
    </motion.div>
  );
}

function ProfileSection({ data, update }) {
  const p = data.profile || {};
  const set = (field, val) => update((d) => ({ ...d, profile: { ...d.profile, [field]: val } }));

  return (
    <div className="max-w-xl space-y-4">
      <SectionCard title="Profile Info">
        <FieldRow label="Display Name">
          <input className="input-field" value={p.display_name || ""} onChange={(e) => set("display_name", e.target.value)} placeholder="Your display name" />
        </FieldRow>
        <FieldRow label="Location">
          <input className="input-field" value={p.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. San Francisco, CA" />
        </FieldRow>
        <FieldRow label="GitHub">
          <input className="input-field" value={p.github || ""} onChange={(e) => set("github", e.target.value)} placeholder="Set automatically on login" />
        </FieldRow>
      </SectionCard>
    </div>
  );
}

function ComputersSection({ data, update }) {
  const computers = data.computers || [];

  const addComputer = () => {
    update((d) => ({ ...d, computers: [...(d.computers || []), createDefaultComputer()] }));
  };

  const removeComputer = (idx) => {
    update((d) => ({ ...d, computers: d.computers.filter((_, i) => i !== idx) }));
  };

  const updateComp = (idx, fn) => {
    update((d) => ({
      ...d,
      computers: d.computers.map((c, i) => (i === idx ? (typeof fn === "function" ? fn(c) : { ...c, ...fn }) : c)),
    }));
  };

  return (
    <div className="space-y-4">
      {computers.map((comp, idx) => (
        <ComputerEditor key={comp.id || idx} comp={comp} idx={idx} updateComp={updateComp} removeComputer={removeComputer} />
      ))}
      <button onClick={addComputer} className="btn-secondary text-xs w-full">
        <Plus size={13} /> Add Computer
      </button>
    </div>
  );
}

function ComputerEditor({ comp, idx, updateComp, removeComputer }) {
  const [open, setOpen] = useState({ general: true, cpu: true, gpu: true, ram: true, mb: false, storage: true, psu: false, cooler: false, case_: false, software: true, peripherals: false, camera: false });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = (path, val) => {
    updateComp(idx, (c) => {
      const next = JSON.parse(JSON.stringify(c));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = isNaN(keys[i]) ? keys[i] : Number(keys[i]);
        obj = obj[k];
      }
      obj[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const c = comp.components || {};

  return (
    <div className="card">
      <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <MonitorIcon size={14} className="text-[var(--text-secondary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{comp.name || `Computer ${idx + 1}`}</h3>
            <p className="text-[0.625rem] text-[var(--text-muted)] font-mono">{comp.type} · {comp.role}</p>
          </div>
        </div>
        <button onClick={() => removeComputer(idx)} className="btn-ghost text-red-400/70 hover:text-red-400 p-1.5">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-5 space-y-3">
        <CollapsibleSection title="General" icon={MonitorIcon} open={open.general} toggle={() => toggle("general")}>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Name"><input className="input-field" value={comp.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. D3SKT0P" /></FieldRow>
            <FieldRow label="ID"><input className="input-field" value={comp.id || ""} onChange={(e) => set("id", e.target.value)} placeholder="desktop-main" /></FieldRow>
            <FieldRow label="Type"><SelectField value={comp.type} options={COMPUTER_TYPES} onChange={(v) => set("type", v)} /></FieldRow>
            <FieldRow label="Role"><SelectField value={comp.role} options={COMPUTER_ROLES} onChange={(v) => set("role", v)} /></FieldRow>
            <FieldRow label="Manufacturer"><input className="input-field" value={comp.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} /></FieldRow>
            <FieldRow label="Year"><input className="input-field" type="number" value={comp.year || ""} onChange={(e) => set("year", Number(e.target.value))} /></FieldRow>
          </div>
          <FieldRow label="Description" className="mt-3">
            <textarea className="input-field resize-none h-16" value={comp.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Short description of this machine" />
          </FieldRow>
          <FieldRow label="Virtual Machine" className="mt-3">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={comp.virtual_machine || false} onChange={(e) => set("virtual_machine", e.target.checked)} className="accent-white" /> This is a virtual machine
            </label>
          </FieldRow>
        </CollapsibleSection>

        <CollapsibleSection title="CPU" icon={Cpu} open={open.cpu} toggle={() => toggle("cpu")}>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={c.cpu?.brand || ""} onChange={(e) => set("components.cpu.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Series"><input className="input-field" value={c.cpu?.series || ""} onChange={(e) => set("components.cpu.series", e.target.value)} placeholder="e.g. i5, Ryzen 7" /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={c.cpu?.model || ""} onChange={(e) => set("components.cpu.model", e.target.value)} /></FieldRow>
            <FieldRow label="Architecture"><input className="input-field" value={c.cpu?.architecture || ""} onChange={(e) => set("components.cpu.architecture", e.target.value)} /></FieldRow>
            <FieldRow label="Cores"><input className="input-field" type="number" value={c.cpu?.cores || ""} onChange={(e) => set("components.cpu.cores", Number(e.target.value))} /></FieldRow>
            <FieldRow label="Threads"><input className="input-field" type="number" value={c.cpu?.threads || ""} onChange={(e) => set("components.cpu.threads", Number(e.target.value))} /></FieldRow>
            <FieldRow label="Base Clock (MHz)"><input className="input-field" type="number" value={c.cpu?.base_clock_mhz || ""} onChange={(e) => set("components.cpu.base_clock_mhz", Number(e.target.value))} /></FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={`GPU (${c.gpu?.length || 0})`} icon={MonitorIcon} open={open.gpu} toggle={() => toggle("gpu")}>
          <ArrayEditor items={c.gpu || []} onAdd={() => set("components.gpu", [...(c.gpu || []), createDefaultGpu()])} onRemove={(i) => set("components.gpu", (c.gpu || []).filter((_, j) => j !== i))} renderItem={(g, i) => (
            <div className="grid grid-cols-3 gap-2">
              <FieldRow label="Brand"><input className="input-field" value={g.brand || ""} onChange={(e) => set(`components.gpu.${i}.brand`, e.target.value)} /></FieldRow>
              <FieldRow label="Model"><input className="input-field" value={g.model || ""} onChange={(e) => set(`components.gpu.${i}.model`, e.target.value)} /></FieldRow>
              <FieldRow label="VRAM (GB)"><input className="input-field" type="number" value={g.vram_gb || ""} onChange={(e) => set(`components.gpu.${i}.vram_gb`, Number(e.target.value))} /></FieldRow>
            </div>
          )} />
        </CollapsibleSection>

        <CollapsibleSection title={`RAM (${c.ram?.length || 0})`} icon={MemoryStick} open={open.ram} toggle={() => toggle("ram")}>
          <ArrayEditor items={c.ram || []} onAdd={() => set("components.ram", [...(c.ram || []), createDefaultRam()])} onRemove={(i) => set("components.ram", (c.ram || []).filter((_, j) => j !== i))} renderItem={(r, i) => (
            <div className="grid grid-cols-3 gap-2">
              <FieldRow label="Type"><SelectField value={r.type} options={RAM_TYPES} onChange={(v) => set(`components.ram.${i}.type`, v)} /></FieldRow>
              <FieldRow label="Capacity (GB)"><input className="input-field" type="number" value={r.capacity_gb || ""} onChange={(e) => set(`components.ram.${i}.capacity_gb`, Number(e.target.value))} /></FieldRow>
              <FieldRow label="Speed (MHz)"><input className="input-field" type="number" value={r.speed_mhz || ""} onChange={(e) => set(`components.ram.${i}.speed_mhz`, Number(e.target.value))} /></FieldRow>
              <FieldRow label="Manufacturer"><input className="input-field" value={r.manufacturer || ""} onChange={(e) => set(`components.ram.${i}.manufacturer`, e.target.value)} /></FieldRow>
              <FieldRow label="Model"><input className="input-field" value={r.model || ""} onChange={(e) => set(`components.ram.${i}.model`, e.target.value)} /></FieldRow>
              <FieldRow label="Modules"><input className="input-field" type="number" value={r.modules || ""} onChange={(e) => set(`components.ram.${i}.modules`, Number(e.target.value))} /></FieldRow>
            </div>
          )} />
        </CollapsibleSection>

        <CollapsibleSection title="Motherboard" icon={CircuitBoard} open={open.mb} toggle={() => toggle("mb")}>
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={c.motherboard?.brand || ""} onChange={(e) => set("components.motherboard.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={c.motherboard?.model || ""} onChange={(e) => set("components.motherboard.model", e.target.value)} /></FieldRow>
            <FieldRow label="Chipset"><input className="input-field" value={c.motherboard?.chipset || ""} onChange={(e) => set("components.motherboard.chipset", e.target.value)} /></FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={`Storage (${c.storage?.length || 0})`} icon={HardDrive} open={open.storage} toggle={() => toggle("storage")}>
          <ArrayEditor items={c.storage || []} onAdd={() => set("components.storage", [...(c.storage || []), createDefaultStorage()])} onRemove={(i) => set("components.storage", (c.storage || []).filter((_, j) => j !== i))} renderItem={(s, i) => (
            <div className="grid grid-cols-3 gap-2">
              <FieldRow label="Type"><SelectField value={s.type} options={STORAGE_TYPES} onChange={(v) => set(`components.storage.${i}.type`, v)} /></FieldRow>
              <FieldRow label="Form Factor"><SelectField value={s.form_factor} options={STORAGE_FORM_FACTORS} onChange={(v) => set(`components.storage.${i}.form_factor`, v)} /></FieldRow>
              <FieldRow label="Capacity (GB)"><input className="input-field" type="number" value={s.capacity_gb || ""} onChange={(e) => set(`components.storage.${i}.capacity_gb`, Number(e.target.value))} /></FieldRow>
              <FieldRow label="Brand"><input className="input-field" value={s.brand || ""} onChange={(e) => set(`components.storage.${i}.brand`, e.target.value)} /></FieldRow>
              <FieldRow label="Model"><input className="input-field" value={s.model || ""} onChange={(e) => set(`components.storage.${i}.model`, e.target.value)} /></FieldRow>
            </div>
          )} />
        </CollapsibleSection>

        <CollapsibleSection title="PSU" icon={CircuitBoard} open={open.psu} toggle={() => toggle("psu")}>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={c.psu?.brand || ""} onChange={(e) => set("components.psu.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={c.psu?.model || ""} onChange={(e) => set("components.psu.model", e.target.value)} /></FieldRow>
            <FieldRow label="Wattage"><input className="input-field" type="number" value={c.psu?.wattage || ""} onChange={(e) => set("components.psu.wattage", Number(e.target.value))} /></FieldRow>
            <FieldRow label="Efficiency"><SelectField value={c.psu?.efficiency || ""} options={PSU_EFFICIENCIES} onChange={(v) => set("components.psu.efficiency", v)} /></FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Cooler" icon={CircuitBoard} open={open.cooler} toggle={() => toggle("cooler")}>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={c.cooler?.brand || ""} onChange={(e) => set("components.cooler.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={c.cooler?.model || ""} onChange={(e) => set("components.cooler.model", e.target.value)} /></FieldRow>
            <FieldRow label="Fans"><input className="input-field" type="number" value={c.cooler?.fans || ""} onChange={(e) => set("components.cooler.fans", Number(e.target.value))} /></FieldRow>
            <FieldRow label="Water Cooling">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer mt-1">
                <input type="checkbox" checked={c.cooler?.water_cooling || false} onChange={(e) => set("components.cooler.water_cooling", e.target.checked)} className="accent-white" /> AIO / Custom Loop
              </label>
            </FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Case" icon={MonitorIcon} open={open.case_} toggle={() => toggle("case_")}>
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={c.case?.brand || ""} onChange={(e) => set("components.case.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={c.case?.model || ""} onChange={(e) => set("components.case.model", e.target.value)} /></FieldRow>
            <FieldRow label="Fans"><input className="input-field" type="number" value={c.case?.fans || ""} onChange={(e) => set("components.case.fans", Number(e.target.value))} /></FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={`Operating System (${comp.software?.os_list?.length || 0})`} icon={MonitorIcon} open={open.software} toggle={() => toggle("software")}>
          <ArrayEditor items={comp.software?.os_list || []} onAdd={() => set("software.os_list", [...(comp.software?.os_list || []), createDefaultOS()])} onRemove={(i) => set("software.os_list", (comp.software?.os_list || []).filter((_, j) => j !== i))} renderItem={(os, i) => (
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="OS Name"><input className="input-field" value={os.name || ""} onChange={(e) => set(`software.os_list.${i}.name`, e.target.value)} /></FieldRow>
              <FieldRow label="Version"><input className="input-field" value={os.version || ""} onChange={(e) => set(`software.os_list.${i}.version`, e.target.value)} /></FieldRow>
              <FieldRow label="Edition"><input className="input-field" value={os.edition || ""} onChange={(e) => set(`software.os_list.${i}.edition`, e.target.value)} /></FieldRow>
              <FieldRow label="Kernel"><input className="input-field" value={os.kernel || ""} onChange={(e) => set(`software.os_list.${i}.kernel`, e.target.value)} /></FieldRow>
              <FieldRow label="Desktop Environment"><input className="input-field" value={os.desktop_environment || ""} onChange={(e) => set(`software.os_list.${i}.desktop_environment`, e.target.value)} /></FieldRow>
              <FieldRow label="Renderer"><input className="input-field" value={os.renderer || ""} onChange={(e) => set(`software.os_list.${i}.renderer`, e.target.value)} placeholder="e.g. Wayland, X11" /></FieldRow>
              <FieldRow label="Primary">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer mt-1">
                  <input type="checkbox" checked={os.is_primary || false} onChange={(e) => set(`software.os_list.${i}.is_primary`, e.target.checked)} className="accent-white" /> Primary OS
                </label>
              </FieldRow>
            </div>
          )} />
        </CollapsibleSection>

        <CollapsibleSection title="Peripherals" icon={MonitorIcon} open={open.peripherals} toggle={() => toggle("peripherals")}>
          <div className="space-y-4">
            <div>
              <p className="section-label">Monitors ({comp.peripherals?.monitor?.length || 0})</p>
              <ArrayEditor items={comp.peripherals?.monitor || []} onAdd={() => set("peripherals.monitor", [...(comp.peripherals?.monitor || []), createDefaultMonitor()])} onRemove={(i) => set("peripherals.monitor", (comp.peripherals?.monitor || []).filter((_, j) => j !== i))} renderItem={(m, i) => (
                <div className="grid grid-cols-3 gap-2">
                  <FieldRow label="Brand"><input className="input-field" value={m.brand || ""} onChange={(e) => set(`peripherals.monitor.${i}.brand`, e.target.value)} /></FieldRow>
                  <FieldRow label="Model"><input className="input-field" value={m.model || ""} onChange={(e) => set(`peripherals.monitor.${i}.model`, e.target.value)} /></FieldRow>
                  <FieldRow label="Size (inch)"><input className="input-field" type="number" value={m.size_inch || ""} onChange={(e) => set(`peripherals.monitor.${i}.size_inch`, Number(e.target.value))} /></FieldRow>
                  <FieldRow label="Width"><input className="input-field" type="number" value={m.resolution?.width || ""} onChange={(e) => set(`peripherals.monitor.${i}.resolution.width`, Number(e.target.value))} /></FieldRow>
                  <FieldRow label="Height"><input className="input-field" type="number" value={m.resolution?.height || ""} onChange={(e) => set(`peripherals.monitor.${i}.resolution.height`, Number(e.target.value))} /></FieldRow>
                  <FieldRow label="Refresh Rate"><input className="input-field" type="number" value={m.refresh_rate_hz || ""} onChange={(e) => set(`peripherals.monitor.${i}.refresh_rate_hz`, Number(e.target.value))} /></FieldRow>
                </div>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="section-label">Keyboard</p>
                <div className="space-y-2">
                  <FieldRow label="Brand"><input className="input-field" value={comp.peripherals?.keyboard?.brand || ""} onChange={(e) => set("peripherals.keyboard.brand", e.target.value)} /></FieldRow>
                  <FieldRow label="Model"><input className="input-field" value={comp.peripherals?.keyboard?.model || ""} onChange={(e) => set("peripherals.keyboard.model", e.target.value)} /></FieldRow>
                  <FieldRow label="Switches"><input className="input-field" value={comp.peripherals?.keyboard?.switches || ""} onChange={(e) => set("peripherals.keyboard.switches", e.target.value)} /></FieldRow>
                </div>
              </div>
              <div>
                <p className="section-label">Mouse</p>
                <div className="space-y-2">
                  <FieldRow label="Brand"><input className="input-field" value={comp.peripherals?.mouse?.brand || ""} onChange={(e) => set("peripherals.mouse.brand", e.target.value)} /></FieldRow>
                  <FieldRow label="Model"><input className="input-field" value={comp.peripherals?.mouse?.model || ""} onChange={(e) => set("peripherals.mouse.model", e.target.value)} /></FieldRow>
                </div>
              </div>
            </div>
            <div>
              <p className="section-label">Audio</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <p className="text-[0.6rem] text-[var(--text-muted)]">Headphones</p>
                  <input className="input-field" placeholder="Brand" value={comp.peripherals?.audio?.headphones?.brand || ""} onChange={(e) => set("peripherals.audio.headphones.brand", e.target.value)} />
                  <input className="input-field" placeholder="Model" value={comp.peripherals?.audio?.headphones?.model || ""} onChange={(e) => set("peripherals.audio.headphones.model", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-[0.6rem] text-[var(--text-muted)]">Microphone</p>
                  <input className="input-field" placeholder="Brand" value={comp.peripherals?.audio?.microphone?.brand || ""} onChange={(e) => set("peripherals.audio.microphone.brand", e.target.value)} />
                  <input className="input-field" placeholder="Model" value={comp.peripherals?.audio?.microphone?.model || ""} onChange={(e) => set("peripherals.audio.microphone.model", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-[0.6rem] text-[var(--text-muted)]">Speakers</p>
                  <input className="input-field" placeholder="Brand" value={comp.peripherals?.audio?.speakers?.brand || ""} onChange={(e) => set("peripherals.audio.speakers.brand", e.target.value)} />
                  <input className="input-field" placeholder="Model" value={comp.peripherals?.audio?.speakers?.model || ""} onChange={(e) => set("peripherals.audio.speakers.model", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Camera" icon={MonitorIcon} open={open.camera} toggle={() => toggle("camera")}>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Brand"><input className="input-field" value={comp.camera?.brand || ""} onChange={(e) => set("camera.brand", e.target.value)} /></FieldRow>
            <FieldRow label="Model"><input className="input-field" value={comp.camera?.model || ""} onChange={(e) => set("camera.model", e.target.value)} /></FieldRow>
            <FieldRow label="Width"><input className="input-field" type="number" value={comp.camera?.resolution?.width || ""} onChange={(e) => set("camera.resolution.width", Number(e.target.value))} /></FieldRow>
            <FieldRow label="Height"><input className="input-field" type="number" value={comp.camera?.resolution?.height || ""} onChange={(e) => set("camera.resolution.height", Number(e.target.value))} /></FieldRow>
            <FieldRow label="FPS"><input className="input-field" type="number" value={comp.camera?.fps || ""} onChange={(e) => set("camera.fps", Number(e.target.value))} /></FieldRow>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

function PhonesSection({ data, update }) {
  const phones = data.phones || [];

  const addPhone = () => update((d) => ({ ...d, phones: [...(d.phones || []), createDefaultPhone()] }));
  const removePhone = (idx) => update((d) => ({ ...d, phones: d.phones.filter((_, i) => i !== idx) }));

  const setPhone = (idx, path, val) => {
    update((d) => {
      const next = JSON.parse(JSON.stringify(d));
      const keys = path.split(".");
      let obj = next.phones[idx];
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = val;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {phones.map((phone, idx) => (
        <div key={idx} className="card">
          <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Smartphone size={14} className="text-[var(--text-secondary)]" />
              <span className="text-sm font-semibold">{phone.brand && phone.model ? `${phone.brand} ${phone.model}` : `Phone ${idx + 1}`}</span>
            </div>
            <button onClick={() => removePhone(idx)} className="btn-ghost text-red-400/70 hover:text-red-400 p-1.5"><Trash2 size={14} /></button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <FieldRow label="Brand"><input className="input-field" value={phone.brand || ""} onChange={(e) => setPhone(idx, "brand", e.target.value)} /></FieldRow>
              <FieldRow label="Model"><input className="input-field" value={phone.model || ""} onChange={(e) => setPhone(idx, "model", e.target.value)} /></FieldRow>
              <FieldRow label="SoC"><input className="input-field" value={phone.soc || ""} onChange={(e) => setPhone(idx, "soc", e.target.value)} /></FieldRow>
              <FieldRow label="RAM (GB)"><input className="input-field" type="number" value={phone.ram_gb || ""} onChange={(e) => setPhone(idx, "ram_gb", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Storage (GB)"><input className="input-field" type="number" value={phone.storage_gb || ""} onChange={(e) => setPhone(idx, "storage_gb", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Battery (mAh)"><input className="input-field" type="number" value={phone.battery || ""} onChange={(e) => setPhone(idx, "battery", Number(e.target.value))} /></FieldRow>
            </div>
            <p className="section-label mt-3">Display</p>
            <div className="grid grid-cols-3 gap-3">
              <FieldRow label="Size (inch)"><input className="input-field" type="number" step="0.1" value={phone.display?.size_inch || ""} onChange={(e) => setPhone(idx, "display.size_inch", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Width"><input className="input-field" type="number" value={phone.display?.resolution?.width || ""} onChange={(e) => setPhone(idx, "display.resolution.width", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Height"><input className="input-field" type="number" value={phone.display?.resolution?.height || ""} onChange={(e) => setPhone(idx, "display.resolution.height", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Refresh Rate"><input className="input-field" type="number" value={phone.display?.refresh_rate || ""} onChange={(e) => setPhone(idx, "display.refresh_rate", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Type"><SelectField value={phone.display?.type || ""} options={DISPLAY_TYPES} onChange={(v) => setPhone(idx, "display.type", v)} /></FieldRow>
            </div>
            <p className="section-label mt-3">Camera</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Front (MP)"><input className="input-field" type="number" value={phone.camera?.front || ""} onChange={(e) => setPhone(idx, "camera.front", Number(e.target.value))} /></FieldRow>
              <FieldRow label="Rear (comma-separated MP)">
                <input className="input-field" value={(phone.camera?.rear || []).join(", ")} onChange={(e) => setPhone(idx, "camera.rear", e.target.value.split(",").map((v) => Number(v.trim())).filter(Boolean))} placeholder="e.g. 50, 12, 5" />
              </FieldRow>
            </div>
            <p className="section-label mt-3">OS</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="OS Name"><input className="input-field" value={phone.os?.name || ""} onChange={(e) => setPhone(idx, "os.name", e.target.value)} /></FieldRow>
              <FieldRow label="Rooted">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer mt-1">
                  <input type="checkbox" checked={phone.os?.root || false} onChange={(e) => setPhone(idx, "os.root", e.target.checked)} className="accent-white" /> Device is rooted
                </label>
              </FieldRow>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addPhone} className="btn-secondary text-xs w-full">
        <Plus size={13} /> Add Phone
      </button>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="card p-5">
      {title && <h3 className="text-sm font-semibold mb-4">{title}</h3>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, open, toggle, children }) {
  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.02] transition-colors">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {Icon && <Icon size={12} />}
        {title}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function ArrayEditor({ items, onAdd, onRemove, renderItem }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative bg-white/[0.015] border border-[var(--border-subtle)] rounded-lg p-3">
          <button onClick={() => onRemove(i)} className="absolute top-2 right-2 btn-ghost text-red-400/50 hover:text-red-400 p-1" title="Remove">
            <Trash2 size={11} />
          </button>
          {renderItem(item, i)}
        </div>
      ))}
      <button onClick={onAdd} className="btn-ghost text-xs w-full border border-dashed border-[var(--border)] rounded-lg py-2">
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

function FieldRow({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-[0.65rem] font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider font-mono">{label}</label>
      {children}
    </div>
  );
}

function SelectField({ value, options, onChange }) {
  return (
    <select className="select-field" value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
