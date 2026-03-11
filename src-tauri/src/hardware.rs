use serde::{Deserialize, Serialize};
use sysinfo::{Disks, System};

#[cfg(any(target_os = "linux", target_os = "windows", target_os = "macos"))]
use std::process::Command;

#[cfg(target_os = "linux")]
use std::fs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HardwareInfo {
    pub cpu: CpuInfo,
    pub gpus: Vec<GpuInfo>,
    pub ram_total_gb: f64,
    pub ram_modules: Vec<RamModuleInfo>,
    pub motherboard: MotherboardInfo,
    pub storage: Vec<StorageInfo>,
    pub monitors: Vec<MonitorInfo>,
    pub os: OsInfo,
    pub hostname: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CpuInfo {
    pub brand: String,
    pub series: String,
    pub model: String,
    pub full_name: String,
    pub architecture: String,
    pub cores: usize,
    pub threads: usize,
    pub base_clock_mhz: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GpuInfo {
    pub brand: String,
    pub model: String,
    pub vram_gb: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RamModuleInfo {
    pub ram_type: String,
    pub capacity_gb: f64,
    pub speed_mhz: u64,
    pub manufacturer: String,
    pub model: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MotherboardInfo {
    pub brand: String,
    pub model: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StorageInfo {
    pub name: String,
    pub mount_point: String,
    pub kind: String,
    pub capacity_gb: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub refresh_rate_hz: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
    pub kernel: String,
    pub desktop_environment: String,
    pub renderer: String,
}

pub fn collect() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    HardwareInfo {
        cpu: collect_cpu(&sys),
        gpus: collect_gpus(),
        ram_total_gb: round2(sys.total_memory() as f64 / 1_073_741_824.0),
        ram_modules: collect_ram_modules(),
        motherboard: collect_motherboard(),
        storage: collect_storage(),
        monitors: collect_monitors(),
        os: collect_os(),
        hostname: System::host_name().unwrap_or_default(),
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------

fn collect_cpu(sys: &System) -> CpuInfo {
    let cpus = sys.cpus();
    if cpus.is_empty() {
        return CpuInfo {
            brand: String::new(),
            series: String::new(),
            model: String::new(),
            full_name: String::new(),
            architecture: std::env::consts::ARCH.to_string(),
            cores: 0,
            threads: 0,
            base_clock_mhz: 0,
        };
    }

    let full_name = cpus[0].brand().trim().to_string();
    let (brand, series, model) = parse_cpu_name(&full_name);

    CpuInfo {
        brand,
        series,
        model,
        full_name,
        architecture: std::env::consts::ARCH.to_string(),
        cores: sys.physical_core_count().unwrap_or(0),
        threads: cpus.len(),
        base_clock_mhz: cpus[0].frequency(),
    }
}

fn parse_cpu_name(name: &str) -> (String, String, String) {
    let cleaned = name
        .replace("(R)", "")
        .replace("(TM)", "")
        .replace("(tm)", "");

    let base = cleaned
        .split(" @ ")
        .next()
        .unwrap_or(&cleaned)
        .trim();
    let base = base
        .split(" CPU")
        .next()
        .unwrap_or(base)
        .trim();
    let base = base
        .split(" Processor")
        .next()
        .unwrap_or(base)
        .trim();

    if base.contains("Intel") {
        let rest = base
            .replace("Intel Core ", "")
            .replace("Intel ", "")
            .trim()
            .to_string();

        if rest.starts_with("i3")
            || rest.starts_with("i5")
            || rest.starts_with("i7")
            || rest.starts_with("i9")
        {
            if let Some(dash) = rest.find('-') {
                return (
                    "Intel".into(),
                    rest[..dash].to_string(),
                    rest[dash + 1..].trim().to_string(),
                );
            }
            return ("Intel".into(), rest.clone(), String::new());
        }

        if rest.starts_with("Xeon") || rest.starts_with("Celeron") || rest.starts_with("Pentium")
        {
            let parts: Vec<&str> = rest.splitn(2, ' ').collect();
            if parts.len() == 2 {
                return (
                    "Intel".into(),
                    parts[0].to_string(),
                    parts[1].to_string(),
                );
            }
        }

        ("Intel".into(), String::new(), rest)
    } else if base.contains("AMD") {
        let rest = base.replace("AMD ", "").trim().to_string();

        if rest.starts_with("Ryzen") {
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 3 {
                let series = format!("{} {}", parts[0], parts[1]);
                let model_parts: Vec<&str> = parts[2..]
                    .iter()
                    .take_while(|p| {
                        !p.ends_with("-Core")
                            && !p.eq_ignore_ascii_case(&"Processor")
                            && !p.eq_ignore_ascii_case(&"with")
                    })
                    .copied()
                    .collect();
                let model = model_parts.join(" ");
                return ("AMD".into(), series, model);
            }
        }

        if rest.starts_with("EPYC") || rest.starts_with("Athlon") {
            let parts: Vec<&str> = rest.splitn(2, ' ').collect();
            if parts.len() == 2 {
                return (
                    "AMD".into(),
                    parts[0].to_string(),
                    parts[1].to_string(),
                );
            }
        }

        ("AMD".into(), String::new(), rest)
    } else if base.contains("Apple") {
        let rest = base.replace("Apple ", "").trim().to_string();
        let parts: Vec<&str> = rest.splitn(2, ' ').collect();
        if parts.len() >= 2 {
            ("Apple".into(), parts[0].to_string(), parts[1].to_string())
        } else {
            ("Apple".into(), rest, String::new())
        }
    } else {
        (String::new(), String::new(), base.to_string())
    }
}

fn parse_gpu_name(desc: &str) -> (String, String) {
    let cleaned = desc
        .replace("NVIDIA Corporation", "NVIDIA")
        .replace("Advanced Micro Devices, Inc.", "AMD")
        .replace("Intel Corporation", "Intel")
        .replace('[', "")
        .replace(']', "");

    if cleaned.starts_with("NVIDIA")
        || cleaned.contains("GeForce")
        || cleaned.contains("Quadro")
        || cleaned.contains("RTX")
    {
        let model = cleaned.replace("NVIDIA ", "").trim().to_string();
        ("NVIDIA".into(), model)
    } else if cleaned.starts_with("AMD") || cleaned.contains("Radeon") {
        let model = cleaned
            .replace("AMD ", "")
            .replace("AMD/ATI ", "")
            .trim()
            .to_string();
        ("AMD".into(), model)
    } else if cleaned.starts_with("Apple") {
        let model = cleaned.replace("Apple ", "").trim().to_string();
        ("Apple".into(), model)
    } else if cleaned.starts_with("Intel")
        || cleaned.contains("UHD")
        || cleaned.contains("Iris")
    {
        let model = cleaned.replace("Intel ", "").trim().to_string();
        ("Intel".into(), model)
    } else {
        (String::new(), cleaned.trim().to_string())
    }
}

// ---------------------------------------------------------------------------
// GPU detection — platform-specific
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn collect_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    if let Ok(output) = Command::new("lspci").output() {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let lower = line.to_lowercase();
            if lower.contains("vga")
                || lower.contains("3d controller")
                || lower.contains("display controller")
            {
                if let Some(desc) = line.split(": ").nth(1) {
                    let (brand, model) = parse_gpu_name(desc);
                    gpus.push(GpuInfo {
                        brand,
                        model,
                        vram_gb: 0.0,
                    });
                }
            }
        }
    }

    if gpus.is_empty() {
        if let Ok(entries) = fs::read_dir("/sys/class/drm") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("card") && !name.contains('-') {
                    let base = entry.path().join("device");
                    if let Ok(vendor) = fs::read_to_string(base.join("vendor")) {
                        let vendor = vendor.trim();
                        let brand = match vendor {
                            "0x10de" => "NVIDIA",
                            "0x1002" => "AMD",
                            "0x8086" => "Intel",
                            _ => "Unknown",
                        };
                        let vram_gb = fs::read_to_string(base.join("mem_info_vram_total"))
                            .ok()
                            .and_then(|s| s.trim().parse::<u64>().ok())
                            .map(|b| round2(b as f64 / 1_073_741_824.0))
                            .unwrap_or(0.0);
                        gpus.push(GpuInfo {
                            brand: brand.to_string(),
                            model: String::new(),
                            vram_gb,
                        });
                    }
                }
            }
        }
    }

    gpus
}

#[cfg(target_os = "windows")]
fn run_powershell(script: &str) -> Option<String> {
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
}

#[cfg(target_os = "windows")]
fn collect_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();
    let mut filled = false;

    if let Ok(output) = Command::new("wmic")
        .args([
            "path",
            "win32_videocontroller",
            "get",
            "name,adapterram",
            "/format:list",
        ])
        .output()
    {
        if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        let mut current_name = String::new();
        let mut current_vram: f64 = 0.0;

        for line in text.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("AdapterRAM=") {
                current_vram = val.parse::<f64>().unwrap_or(0.0);
            } else if let Some(val) = line.strip_prefix("Name=") {
                if !current_name.is_empty() {
                    let (brand, model) = parse_gpu_name(&current_name);
                    gpus.push(GpuInfo {
                        brand,
                        model,
                        vram_gb: round2(current_vram / 1_073_741_824.0),
                    });
                }
                current_name = val.trim().to_string();
                current_vram = 0.0;
            }
        }

        if !current_name.is_empty() {
            let (brand, model) = parse_gpu_name(&current_name);
            gpus.push(GpuInfo {
                brand,
                model,
                vram_gb: round2(current_vram / 1_073_741_824.0),
            });
        }
        filled = !gpus.is_empty();
        }
    }

    if !filled {
        if let Some(text) = run_powershell(
            "Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object { $n=$_.Name; $r=if($_.AdapterRAM){$_.AdapterRAM}else{0}; \"$n|$r\" }",
        ) {
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let parts: Vec<&str> = line.splitn(2, '|').collect();
                if parts.len() >= 1 && !parts[0].is_empty() {
                    let (brand, model) = parse_gpu_name(parts[0]);
                    let vram_gb = parts
                        .get(1)
                        .and_then(|s| s.parse::<f64>().ok())
                        .map(|b| round2(b / 1_073_741_824.0))
                        .unwrap_or(0.0);
                    gpus.push(GpuInfo {
                        brand,
                        model,
                        vram_gb,
                    });
                }
            }
        }
    }

    gpus
}

#[cfg(target_os = "macos")]
fn collect_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    if let Ok(output) = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(displays) = value["SPDisplaysDataType"].as_array() {
                    for display in displays {
                        let name = display["sppci_model"]
                            .as_str()
                            .or_else(|| display["_name"].as_str())
                            .unwrap_or("")
                            .to_string();

                        let vram_str = display["sppci_vram"].as_str().unwrap_or("0");
                        let vram_gb = parse_macos_vram(vram_str);

                        if !name.is_empty() {
                            let (brand, model) = parse_gpu_name(&name);
                            gpus.push(GpuInfo {
                                brand,
                                model,
                                vram_gb,
                            });
                        }
                    }
                }
            }
        }
    }

    gpus
}

#[cfg(target_os = "macos")]
fn parse_macos_vram(s: &str) -> f64 {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.is_empty() {
        return 0.0;
    }
    let num: f64 = parts[0].parse().unwrap_or(0.0);
    if parts.len() > 1 && parts[1].eq_ignore_ascii_case("GB") {
        num
    } else {
        round2(num / 1024.0)
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn collect_gpus() -> Vec<GpuInfo> {
    Vec::new()
}

// ---------------------------------------------------------------------------
// RAM modules — platform-specific
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn collect_ram_modules() -> Vec<RamModuleInfo> {
    if let Ok(output) = Command::new("dmidecode").args(["-t", "17"]).output() {
        if output.status.success() {
            return parse_dmidecode_ram(&String::from_utf8_lossy(&output.stdout));
        }
    }
    Vec::new()
}

#[cfg(target_os = "linux")]
fn parse_dmidecode_ram(text: &str) -> Vec<RamModuleInfo> {
    let mut modules = Vec::new();
    let mut current: Option<RamModuleInfo> = None;

    for line in text.lines() {
        let line = line.trim();

        if line.starts_with("Memory Device") {
            if let Some(m) = current.take() {
                if m.capacity_gb > 0.0 {
                    modules.push(m);
                }
            }
            current = Some(RamModuleInfo {
                ram_type: String::new(),
                capacity_gb: 0.0,
                speed_mhz: 0,
                manufacturer: String::new(),
                model: String::new(),
            });
        }

        if let Some(ref mut m) = current {
            if let Some(val) = line.strip_prefix("Size:") {
                let val = val.trim();
                if val.contains("MB") {
                    m.capacity_gb = val
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse::<f64>().ok())
                        .map(|mb| round2(mb / 1024.0))
                        .unwrap_or(0.0);
                } else if val.contains("GB") {
                    m.capacity_gb = val
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse::<f64>().ok())
                        .unwrap_or(0.0);
                }
            } else if let Some(val) = line.strip_prefix("Type:") {
                let t = val.trim();
                if t != "Unknown" {
                    m.ram_type = t.to_string();
                }
            } else if let Some(val) = line.strip_prefix("Speed:") {
                m.speed_mhz = val
                    .trim()
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if let Some(val) = line.strip_prefix("Manufacturer:") {
                let v = val.trim();
                if v != "Not Specified" && v != "Unknown" {
                    m.manufacturer = v.to_string();
                }
            } else if let Some(val) = line.strip_prefix("Part Number:") {
                let v = val.trim();
                if v != "Not Specified" && v != "Unknown" {
                    m.model = v.to_string();
                }
            }
        }
    }

    if let Some(m) = current {
        if m.capacity_gb > 0.0 {
            modules.push(m);
        }
    }

    modules
}

#[cfg(target_os = "windows")]
fn collect_ram_modules() -> Vec<RamModuleInfo> {
    let mut modules = Vec::new();
    let mut filled = false;

    if let Ok(output) = Command::new("wmic")
        .args([
            "memorychip",
            "get",
            "capacity,manufacturer,partnumber,speed,SMBIOSMemoryType",
            "/format:list",
        ])
        .output()
    {
        if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        let mut cap: f64 = 0.0;
        let mut mfr = String::new();
        let mut part = String::new();
        let mut speed: u64 = 0;
        let mut mem_type: u32 = 0;
        let mut has_data = false;

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                if has_data && cap > 0.0 {
                    modules.push(RamModuleInfo {
                        ram_type: wmic_ram_type(mem_type),
                        capacity_gb: round2(cap / 1_073_741_824.0),
                        speed_mhz: speed,
                        manufacturer: mfr.clone(),
                        model: part.clone(),
                    });
                }
                cap = 0.0;
                mfr.clear();
                part.clear();
                speed = 0;
                mem_type = 0;
                has_data = false;
                continue;
            }
            has_data = true;
            if let Some(v) = line.strip_prefix("Capacity=") {
                cap = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("Manufacturer=") {
                mfr = v.trim().to_string();
            } else if let Some(v) = line.strip_prefix("PartNumber=") {
                part = v.trim().to_string();
            } else if let Some(v) = line.strip_prefix("Speed=") {
                speed = v.trim().parse().unwrap_or(0);
            } else if let Some(v) = line.strip_prefix("SMBIOSMemoryType=") {
                mem_type = v.trim().parse().unwrap_or(0);
            }
        }

        if has_data && cap > 0.0 {
            modules.push(RamModuleInfo {
                ram_type: wmic_ram_type(mem_type),
                capacity_gb: round2(cap / 1_073_741_824.0),
                speed_mhz: speed,
                manufacturer: mfr,
                model: part,
            });
        }
        filled = !modules.is_empty();
        }
    }

    if !filled {
        if let Some(text) = run_powershell(
            "Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue | ForEach-Object { $c=$_.Capacity; $m=$_.Manufacturer; $p=$_.PartNumber; $s=$_.Speed; $t=$_.SMBIOSMemoryType; \"$c|$m|$p|$s|$t\" }",
        ) {
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let parts: Vec<&str> = line.splitn(5, '|').collect();
                if parts.len() >= 1 {
                    let cap: f64 = parts[0].parse().unwrap_or(0.0);
                    if cap <= 0.0 {
                        continue;
                    }
                    let mfr = parts.get(1).unwrap_or(&"").to_string();
                    let part = parts.get(2).unwrap_or(&"").to_string();
                    let speed: u64 = parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(0);
                    let mem_type: u32 = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);
                    modules.push(RamModuleInfo {
                        ram_type: wmic_ram_type(mem_type),
                        capacity_gb: round2(cap / 1_073_741_824.0),
                        speed_mhz: speed,
                        manufacturer: mfr,
                        model: part,
                    });
                }
            }
        }
    }

    modules
}

#[cfg(target_os = "windows")]
fn wmic_ram_type(code: u32) -> String {
    match code {
        20 => "DDR",
        21 => "DDR2",
        24 => "DDR3",
        26 => "DDR4",
        30 => "LPDDR4",
        34 => "DDR5",
        35 => "LPDDR5",
        _ => "DDR4",
    }
    .to_string()
}

#[cfg(target_os = "macos")]
fn collect_ram_modules() -> Vec<RamModuleInfo> {
    if let Ok(output) = Command::new("system_profiler")
        .args(["SPMemoryDataType", "-json"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                return parse_macos_ram(&value);
            }
        }
    }
    Vec::new()
}

#[cfg(target_os = "macos")]
fn parse_macos_ram(root: &serde_json::Value) -> Vec<RamModuleInfo> {
    let mut modules = Vec::new();

    if let Some(arr) = root["SPMemoryDataType"].as_array() {
        for entry in arr {
            if let Some(items) = entry["_items"].as_array() {
                for item in items {
                    let size_str = item["dimm_size"].as_str().unwrap_or("0");
                    let capacity_gb: f64 = size_str
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0.0);

                    if capacity_gb <= 0.0 {
                        continue;
                    }

                    let ram_type = item["dimm_type"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();
                    let speed_str = item["dimm_speed"].as_str().unwrap_or("0");
                    let speed_mhz: u64 = speed_str
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    let manufacturer = item["dimm_manufacturer"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();
                    let model = item["dimm_part_number"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();

                    modules.push(RamModuleInfo {
                        ram_type,
                        capacity_gb,
                        speed_mhz,
                        manufacturer,
                        model,
                    });
                }
            }
        }
    }

    modules
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn collect_ram_modules() -> Vec<RamModuleInfo> {
    Vec::new()
}

// ---------------------------------------------------------------------------
// Motherboard detection — platform-specific
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn collect_motherboard() -> MotherboardInfo {
    let brand = fs::read_to_string("/sys/class/dmi/id/board_vendor")
        .unwrap_or_default()
        .trim()
        .to_string();
    let model = fs::read_to_string("/sys/class/dmi/id/board_name")
        .unwrap_or_default()
        .trim()
        .to_string();

    MotherboardInfo { brand, model }
}

#[cfg(target_os = "windows")]
fn collect_motherboard() -> MotherboardInfo {
    let mut brand = String::new();
    let mut model = String::new();

    if let Ok(output) = Command::new("wmic")
        .args(["baseboard", "get", "manufacturer,product", "/format:list"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let line = line.trim();
                if let Some(val) = line.strip_prefix("Manufacturer=") {
                    brand = val.trim().to_string();
                } else if let Some(val) = line.strip_prefix("Product=") {
                    model = val.trim().to_string();
                }
            }
        }
    }

    if brand.is_empty() && model.is_empty() {
        if let Some(text) = run_powershell(
            "Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { \"$($_.Manufacturer)|$($_.Product)\" }",
        ) {
            let line = text.lines().next().unwrap_or("").trim();
            if !line.is_empty() {
                let parts: Vec<&str> = line.splitn(2, '|').collect();
                if parts.len() >= 1 {
                    brand = parts[0].trim().to_string();
                }
                if parts.len() >= 2 {
                    model = parts[1].trim().to_string();
                }
            }
        }
    }

    MotherboardInfo { brand, model }
}

#[cfg(target_os = "macos")]
fn collect_motherboard() -> MotherboardInfo {
    let model = Command::new("sysctl")
        .args(["-n", "hw.model"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    MotherboardInfo {
        brand: if model.is_empty() {
            String::new()
        } else {
            "Apple".to_string()
        },
        model,
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn collect_motherboard() -> MotherboardInfo {
    MotherboardInfo {
        brand: String::new(),
        model: String::new(),
    }
}

// ---------------------------------------------------------------------------
// Monitor detection — platform-specific
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn collect_monitors() -> Vec<MonitorInfo> {
    if let Ok(output) = Command::new("xrandr").args(["--current"]).output() {
        if output.status.success() {
            return parse_xrandr(&String::from_utf8_lossy(&output.stdout));
        }
    }
    Vec::new()
}

#[cfg(target_os = "linux")]
fn parse_xrandr(text: &str) -> Vec<MonitorInfo> {
    let mut monitors = Vec::new();
    let mut current_name = String::new();

    for line in text.lines() {
        if line.contains(" connected") {
            current_name = line
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_string();
        } else if !current_name.is_empty() && line.contains('*') {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            if let Some(res) = parts.first() {
                let dims: Vec<&str> = res.split('x').collect();
                if dims.len() == 2 {
                    let width = dims[0].parse::<u32>().unwrap_or(0);
                    let height = dims[1].parse::<u32>().unwrap_or(0);

                    let rate = parts[1..]
                        .iter()
                        .find(|s| s.contains('*'))
                        .and_then(|s| {
                            s.replace('*', "")
                                .replace('+', "")
                                .parse::<f64>()
                                .ok()
                        })
                        .map(|r| r.round() as u32)
                        .unwrap_or(60);

                    if width > 0 && height > 0 {
                        monitors.push(MonitorInfo {
                            name: current_name.clone(),
                            width,
                            height,
                            refresh_rate_hz: rate,
                        });
                    }
                }
            }
            current_name.clear();
        }
    }

    monitors
}

#[cfg(target_os = "windows")]
fn collect_monitors() -> Vec<MonitorInfo> {
    let mut monitors = Vec::new();
    let mut filled = false;

    if let Ok(output) = Command::new("wmic")
        .args([
            "path",
            "Win32_VideoController",
            "get",
            "CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate,Name",
            "/format:list",
        ])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut name = String::new();
            let mut w: u32 = 0;
            let mut h: u32 = 0;
            let mut rate: u32 = 0;
            let mut has_data = false;

            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    if has_data && w > 0 && h > 0 {
                        monitors.push(MonitorInfo {
                            name: name.clone(),
                            width: w,
                            height: h,
                            refresh_rate_hz: rate,
                        });
                    }
                    name.clear();
                    w = 0;
                    h = 0;
                    rate = 0;
                    has_data = false;
                    continue;
                }
                has_data = true;
                if let Some(v) = line.strip_prefix("CurrentHorizontalResolution=") {
                    w = v.trim().parse().unwrap_or(0);
                } else if let Some(v) = line.strip_prefix("CurrentVerticalResolution=") {
                    h = v.trim().parse().unwrap_or(0);
                } else if let Some(v) = line.strip_prefix("CurrentRefreshRate=") {
                    rate = v.trim().parse().unwrap_or(0);
                } else if let Some(v) = line.strip_prefix("Name=") {
                    name = v.trim().to_string();
                }
            }

            if has_data && w > 0 && h > 0 {
                monitors.push(MonitorInfo {
                    name,
                    width: w,
                    height: h,
                    refresh_rate_hz: rate,
                });
            }
            filled = !monitors.is_empty();
        }
    }

    if !filled {
        if let Some(text) = run_powershell(
            "Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object { $n=$_.Name; $w=$_.CurrentHorizontalResolution; $h=$_.CurrentVerticalResolution; $r=$_.CurrentRefreshRate; \"$n|$w|$h|$r\" }",
        ) {
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let parts: Vec<&str> = line.splitn(4, '|').collect();
                if parts.len() >= 4 {
                    let w: u32 = parts[1].parse().unwrap_or(0);
                    let h: u32 = parts[2].parse().unwrap_or(0);
                    if w > 0 && h > 0 {
                        let name = parts[0].to_string();
                        let rate: u32 = parts[3].parse().unwrap_or(60);
                        monitors.push(MonitorInfo {
                            name,
                            width: w,
                            height: h,
                            refresh_rate_hz: rate,
                        });
                    }
                }
            }
        }
    }

    monitors
}

#[cfg(target_os = "macos")]
fn collect_monitors() -> Vec<MonitorInfo> {
    let mut monitors = Vec::new();

    if let Ok(output) = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(gpus) = value["SPDisplaysDataType"].as_array() {
                    for gpu in gpus {
                        if let Some(displays) = gpu["spdisplays_ndrvs"].as_array() {
                            for disp in displays {
                                let name = disp["_name"]
                                    .as_str()
                                    .unwrap_or("Display")
                                    .to_string();
                                let res_str = disp["_spdisplays_resolution"]
                                    .as_str()
                                    .unwrap_or("");
                                let (w, h) = parse_macos_resolution(res_str);
                                if w > 0 && h > 0 {
                                    monitors.push(MonitorInfo {
                                        name,
                                        width: w,
                                        height: h,
                                        refresh_rate_hz: 60,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    monitors
}

#[cfg(target_os = "macos")]
fn parse_macos_resolution(s: &str) -> (u32, u32) {
    let cleaned = s
        .replace("Retina", "")
        .replace("retina", "")
        .trim()
        .to_string();
    let parts: Vec<&str> = cleaned.split(" x ").collect();
    if parts.len() == 2 {
        let w = parts[0].trim().parse::<u32>().unwrap_or(0);
        let h = parts[1].trim().parse::<u32>().unwrap_or(0);
        (w, h)
    } else {
        (0, 0)
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn collect_monitors() -> Vec<MonitorInfo> {
    Vec::new()
}

// ---------------------------------------------------------------------------
// Storage & OS — cross-platform via sysinfo
// ---------------------------------------------------------------------------

fn collect_storage() -> Vec<StorageInfo> {
    let disks = Disks::new_with_refreshed_list();

    disks
        .iter()
        .filter(|d| {
            let cap = d.total_space() as f64 / 1_073_741_824.0;
            cap > 1.0
        })
        .map(|d| {
            let name = d.name().to_string_lossy().to_string();
            let mount_point = d.mount_point().to_string_lossy().to_string();
            let kind = match d.kind() {
                sysinfo::DiskKind::SSD => "SSD",
                sysinfo::DiskKind::HDD => "HDD",
                _ => "Unknown",
            }
            .to_string();
            let capacity_gb = round2(d.total_space() as f64 / 1_073_741_824.0);

            StorageInfo {
                name,
                mount_point,
                kind,
                capacity_gb,
            }
        })
        .collect()
}

fn collect_os() -> OsInfo {
    OsInfo {
        name: System::name().unwrap_or_default(),
        version: System::os_version().unwrap_or_default(),
        kernel: System::kernel_version().unwrap_or_default(),
        desktop_environment: detect_desktop_environment(),
        renderer: detect_renderer(),
    }
}

#[cfg(target_os = "linux")]
fn detect_desktop_environment() -> String {
    std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default()
}

#[cfg(target_os = "linux")]
fn detect_renderer() -> String {
    std::env::var("XDG_SESSION_TYPE")
        .map(|s| {
            match s.to_lowercase().as_str() {
                "wayland" => "Wayland",
                "x11" => "X11",
                "tty" => "TTY",
                other => return other.to_string(),
            }
            .to_string()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn detect_desktop_environment() -> String {
    "Explorer".to_string()
}

#[cfg(target_os = "windows")]
fn detect_renderer() -> String {
    "DWM".to_string()
}

#[cfg(target_os = "macos")]
fn detect_desktop_environment() -> String {
    "Aqua".to_string()
}

#[cfg(target_os = "macos")]
fn detect_renderer() -> String {
    "Quartz".to_string()
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn detect_desktop_environment() -> String {
    String::new()
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn detect_renderer() -> String {
    String::new()
}
