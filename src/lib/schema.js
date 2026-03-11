export function createDefaultProfile(username) {
  return {
    username,
    profile: {
      display_name: "",
      location: "",
      github: username,
    },
    computers: [],
    phones: [],
    last_updated: new Date().toISOString(),
  };
}

export function createDefaultComputer(id) {
  return {
    id: id || `computer-${Date.now()}`,
    type: "desktop",
    name: "",
    role: "daily-driver",
    description: "",
    manufacturer: "Custom Build",
    virtual_machine: false,
    year: new Date().getFullYear(),
    components: {
      cpu: { brand: "", series: "", model: "", architecture: "", cores: 0, threads: 0, base_clock_mhz: 0 },
      gpu: [],
      ram: [],
      motherboard: { brand: "", model: "", chipset: "" },
      storage: [],
      psu: { brand: "", model: "", wattage: 0, efficiency: "" },
      cooler: { brand: "", model: "", fans: 0, water_cooling: false },
      case: { brand: "", model: "", fans: 0 },
    },
    software: {
      os_list: [],
    },
    peripherals: {
      monitor: [],
      keyboard: { brand: "", model: "", switches: "", layout: 100 },
      mouse: { brand: "", model: "" },
      audio: {
        headphones: { brand: "", model: "" },
        microphone: { brand: "", model: "" },
        speakers: { brand: "", model: "" },
      },
    },
    camera: { brand: "", model: "", resolution: { width: 0, height: 0 }, fps: 0 },
  };
}

export function createDefaultGpu() {
  return { brand: "", model: "", vram_gb: 0 };
}

export function createDefaultRam() {
  return { type: "DDR4", capacity_gb: 0, modules: 1, speed_mhz: 0, manufacturer: "", model: "" };
}

export function createDefaultStorage() {
  return { type: "SSD", form_factor: "M.2", brand: "", model: "", capacity_gb: 0 };
}

export function createDefaultMonitor() {
  return { brand: "", model: "", size_inch: 0, resolution: { width: 1920, height: 1080 }, refresh_rate_hz: 60 };
}

export function createDefaultOS() {
  return { name: "", version: "", edition: "", kernel: "", desktop_environment: "", renderer: "", is_primary: true };
}

export function createDefaultPhone() {
  return {
    brand: "",
    model: "",
    soc: "",
    ram_gb: 0,
    storage_gb: 0,
    battery: 0,
    display: { size_inch: 0, resolution: { width: 0, height: 0 }, refresh_rate: 60, type: "AMOLED" },
    camera: { front: 0, rear: [] },
    os: { name: "", root: false },
  };
}

export const COMPUTER_TYPES = ["desktop", "laptop", "server", "workstation"];
export const COMPUTER_ROLES = ["daily-driver", "secondary", "gaming", "workstation", "server", "media", "development"];
export const RAM_TYPES = ["DDR3", "DDR4", "DDR5", "SODIMM DDR4", "SODIMM DDR5", "LPDDR4", "LPDDR5"];
export const STORAGE_TYPES = ["SSD", "HDD", "NVMe"];
export const STORAGE_FORM_FACTORS = ["M.2", "SATA", '2.5"', '3.5"'];
export const PSU_EFFICIENCIES = ["", "80+", "Bronze", "Silver", "Gold", "Platinum", "Titanium"];
export const DISPLAY_TYPES = ["AMOLED", "OLED", "LCD", "IPS", "Mini-LED", "Micro-LED"];

function roundToCommercialCapacityGb(value) {
  if (!value || value <= 0) return 0;
  // Common commercial capacities in GB
  const tiers = [
    2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512,
    1000, 2000, 4000, 8000
  ];
  let best = tiers[0];
  let bestDiff = Math.abs(value - best);
  for (const t of tiers) {
    const diff = Math.abs(value - t);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

function roundClockToNearestHundredMhz(value) {
  if (!value || value <= 0) return 0;
  return Math.round(value / 100) * 100;
}

export function hardwareToComputer(hw, existingId) {
  const comp = createDefaultComputer(existingId || "desktop-main");
  comp.name = hw.hostname || "";
  comp.type = "desktop";

  comp.components.cpu = {
    brand: hw.cpu.brand || "",
    series: hw.cpu.series || "",
    model: hw.cpu.model || "",
    architecture: hw.cpu.architecture || "",
    cores: hw.cpu.cores || 0,
    threads: hw.cpu.threads || 0,
    base_clock_mhz: roundClockToNearestHundredMhz(hw.cpu.base_clock_mhz || 0),
  };

  comp.components.gpu = (hw.gpus || []).map((g) => ({
    brand: g.brand || "",
    model: g.model || "",
    vram_gb: g.vram_gb || 0,
  }));

  const ramModules = hw.ram_modules || [];
  if (ramModules.length > 0) {
    comp.components.ram = ramModules.map((m) => ({
      type: m.ram_type || "DDR4",
      capacity_gb: roundToCommercialCapacityGb(m.capacity_gb || 0),
      modules: 1,
      speed_mhz: m.speed_mhz || 0,
      manufacturer: m.manufacturer || "",
      model: m.model || "",
    }));
  } else if (hw.ram_total_gb > 0) {
    comp.components.ram = [
      {
        type: "DDR4",
        capacity_gb: roundToCommercialCapacityGb(hw.ram_total_gb),
        modules: 1,
        speed_mhz: 0,
        manufacturer: "",
        model: "",
      },
    ];
  }

  comp.components.motherboard = {
    brand: hw.motherboard?.brand || "",
    model: hw.motherboard?.model || "",
    chipset: "",
  };

  comp.components.storage = (hw.storage || []).map((s) => ({
    type: s.kind || "SSD",
    form_factor: "",
    brand: "",
    model: s.name || "",
    capacity_gb: roundToCommercialCapacityGb(s.capacity_gb),
  }));

  comp.software.os_list = [{
    name: hw.os?.name || "",
    version: hw.os?.version || "",
    edition: "",
    kernel: hw.os?.kernel || "",
    desktop_environment: hw.os?.desktop_environment || "",
    renderer: hw.os?.renderer || "",
    is_primary: true,
  }];

  const monitors = hw.monitors || [];
  if (monitors.length > 0) {
    comp.peripherals.monitor = monitors.map((m) => ({
      brand: "",
      model: m.name || "",
      size_inch: 0,
      resolution: { width: m.width || 0, height: m.height || 0 },
      refresh_rate_hz: m.refresh_rate_hz || 60,
    }));
  }

  return comp;
}
