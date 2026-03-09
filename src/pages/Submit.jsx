import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send, Loader2, CheckCircle2, ArrowLeft,
  AlertCircle, Upload, ExternalLink, Link2,
} from "lucide-react";
import { fetch } from "@tauri-apps/plugin-http";
import { open } from "@tauri-apps/plugin-shell";
import useStore from "../store/useStore";

function parseSessionInput(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "rigtree:") {
      const endpoint = url.searchParams.get("endpoint");
      const type = url.searchParams.get("type") || "computer";
      if (endpoint) return { endpoint, type };
    }
    if (url.protocol === "https:" || url.protocol === "http:") {
      return { endpoint: trimmed, type: "computer" };
    }
  } catch { /* not a valid URL */ }
  return null;
}

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.3 } };

export default function Submit() {
  const { profileData, sessionEndpoint, sessionType, setStep, setSession } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState("");

  const getDevice = () => {
    if (sessionType === "phone") return profileData?.phones?.[0] || null;
    return profileData?.computers?.[0] || null;
  };

  const sendToSession = async () => {
    const device = getDevice();
    if (!device) { setError("No device data to send."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(sessionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(device),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed to send data: ${res.status}${body ? `: ${body}` : ""}`);
      }
      setSubmitted(true);
    } catch (e) {
      setError(e.message || "Failed to send data to RigTree.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div {...fade} className="h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={24} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Sent to RigTree</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Your {sessionType || "computer"} data has been sent back to the website. You can close this window.
          </p>
        </div>
      </motion.div>
    );
  }

  const applyManualUrl = () => {
    setManualError("");
    const parsed = parseSessionInput(manualUrl);
    if (!parsed) {
      setManualError("Invalid URL. Paste the rigtree://fetch?… link or the session endpoint URL.");
      return;
    }
    setSession(parsed.endpoint, parsed.type);
  };

  if (!sessionEndpoint) {
    return (
      <motion.div {...fade} className="h-full flex flex-col">
        <header className="flex-shrink-0 border-b border-[var(--border-subtle)] px-6 py-3 flex items-center gap-3">
          <button onClick={() => setStep("edit")} className="btn-ghost p-1.5" title="Back to Editor">
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2 className="text-base font-bold tracking-tight">Connect Session</h2>
            <p className="text-[0.65rem] text-[var(--text-muted)]">Link to the RigTree website to send your data</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
                <Link2 size={22} className="text-[var(--text-muted)]" />
              </div>
              <h2 className="text-lg font-bold mb-2">No Active Session</h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Go to{" "}
                <button onClick={() => open("https://rigtree.pages.dev")} className="text-[var(--accent)] hover:underline font-medium">
                  rigtree.pages.dev
                </button>
                , sign in, and click <span className="font-medium text-[var(--text-primary)]">Add Computer</span> or{" "}
                <span className="font-medium text-[var(--text-primary)]">Add Phone</span>.
                The app should open automatically — if it doesn't, paste the session URL below.
              </p>
            </div>

            <div className="card p-5 space-y-3">
              <label className="block text-[0.65rem] font-medium text-[var(--text-muted)] uppercase tracking-wider font-mono">
                Session URL
              </label>
              <input
                className="input-field font-mono text-xs"
                placeholder="rigtree://fetch?endpoint=...&type=computer"
                value={manualUrl}
                onChange={(e) => { setManualUrl(e.target.value); setManualError(""); }}
                onKeyDown={(e) => e.key === "Enter" && applyManualUrl()}
              />
              {manualError && (
                <p className="text-[0.7rem] text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={11} /> {manualError}
                </p>
              )}
              <button onClick={applyManualUrl} disabled={!manualUrl.trim()} className="btn-primary w-full py-2.5 text-sm">
                Connect
              </button>
            </div>

            <p className="text-[0.6rem] text-[var(--text-muted)] text-center leading-relaxed">
              The session URL is shown on the website when you add a device. It looks like{" "}
              <span className="font-mono text-[var(--text-secondary)]">rigtree://fetch?endpoint=…</span> or{" "}
              <span className="font-mono text-[var(--text-secondary)]">https://rigtree-oauth.…/session/…</span>
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const device = getDevice();

  return (
    <motion.div {...fade} className="h-full flex flex-col">
      <header className="flex-shrink-0 border-b border-[var(--border-subtle)] px-6 py-3 flex items-center gap-3">
        <button onClick={() => setStep("edit")} className="btn-ghost p-1.5" title="Back to Editor">
          <ArrowLeft size={15} />
        </button>
        <div>
          <h2 className="text-base font-bold tracking-tight">Send to RigTree</h2>
          <p className="text-[0.65rem] text-[var(--text-muted)]">
            Send your {sessionType || "computer"} data back to the website
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <Upload size={16} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Device Summary</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  This {sessionType || "computer"} will be sent to the RigTree website
                </p>
              </div>
            </div>

            {device ? (
              <div className="space-y-2">
                {sessionType === "phone" ? (
                  <>
                    <SummaryRow label="Brand" value={device.brand} />
                    <SummaryRow label="Model" value={device.model} />
                    <SummaryRow label="SoC" value={device.soc} />
                    <SummaryRow label="RAM" value={device.ram_gb ? `${device.ram_gb} GB` : ""} />
                    <SummaryRow label="Storage" value={device.storage_gb ? `${device.storage_gb} GB` : ""} />
                  </>
                ) : (
                  <>
                    <SummaryRow label="Name" value={device.name} />
                    <SummaryRow label="Type" value={device.type} />
                    <SummaryRow label="CPU" value={`${device.components?.cpu?.brand || ""} ${device.components?.cpu?.model || ""}`.trim()} />
                    <SummaryRow label="GPU" value={(device.components?.gpu || []).map((g) => `${g.brand} ${g.model}`.trim()).join(", ")} />
                    <SummaryRow label="RAM" value={
                      (device.components?.ram || []).reduce((sum, r) => sum + (r.capacity_gb || 0) * (r.modules || 1), 0) + " GB"
                    } />
                    <SummaryRow label="OS" value={(device.software?.os_list || []).map((o) => o.name).filter(Boolean).join(", ")} />
                    <SummaryRow label="Storage" value={
                      (device.components?.storage || []).map((s) => `${Math.round(s.capacity_gb)} GB ${s.type}`).join(", ")
                    } />
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                No {sessionType || "computer"} data found. Go back and add one.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-2">How it works</h3>
            <ol className="text-xs text-[var(--text-secondary)] space-y-1.5 list-decimal list-inside">
              <li>Your scanned {sessionType || "computer"} data is sent to the RigTree website</li>
              <li>The website receives it and adds it to your profile</li>
              <li>You can then submit your full profile from the website</li>
            </ol>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/5 border border-red-400/15 rounded-lg px-4 py-3">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <button onClick={sendToSession} disabled={submitting || !device} className="btn-primary w-full py-3">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? "Sending…" : "Send to RigTree"}
          </button>

        </div>
      </div>
    </motion.div>
  );
}

function SummaryRow({ label, value, indent }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0 ${indent ? "pl-2" : ""}`}>
      <span className={`text-xs ${indent ? "text-[var(--text-muted)] font-mono" : "text-[var(--text-secondary)]"}`}>{label}</span>
      <span className="text-xs text-[var(--text-primary)] font-medium">{value || "—"}</span>
    </div>
  );
}
