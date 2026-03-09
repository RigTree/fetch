import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Github, Loader2, Copy, Check, ExternalLink, AlertCircle } from "lucide-react";
import { fetch } from "@tauri-apps/plugin-http";
import { open } from "@tauri-apps/plugin-shell";
import useStore from "../store/useStore";
import { GitHubService } from "../lib/github";
import { GITHUB_CLIENT_ID } from "../lib/constants";

export default function Login() {
  const { setAuth, setProfileData } = useStore();
  const [phase, setPhase] = useState("idle");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const startLogin = async () => {
    setPhase("requesting");
    setError("");

    try {
      const res = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          scope: "public_repo read:user",
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GitHub returned ${res.status}: ${body}`);
      }

      const info = await res.json();
      setDeviceInfo(info);
      setPhase("waiting");

      await open(info.verification_uri);

      let interval = (info.interval || 5) * 1000;

      const pollForToken = async () => {
        try {
          const tokenRes = await fetch(
            "https://github.com/login/oauth/access_token",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: info.device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              }),
            }
          );

          const result = await tokenRes.json();

          if (result.access_token) {
            clearInterval(pollRef.current);
            setPhase("authenticating");

            const gh = new GitHubService(result.access_token);
            const user = await gh.getUser();
            const existing = await gh.getUserProfile(user.login);
            if (existing) setProfileData(existing);
            setAuth(result.access_token, user);
          } else if (result.error === "slow_down") {
            interval += 5000;
            clearInterval(pollRef.current);
            pollRef.current = setInterval(pollForToken, interval);
          } else if (result.error && result.error !== "authorization_pending") {
            clearInterval(pollRef.current);
            setError(result.error_description || result.error);
            setPhase("error");
          }
        } catch {
          /* keep polling */
        }
      };

      pollRef.current = setInterval(pollForToken, interval);
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  };

  const copyCode = () => {
    if (!deviceInfo?.user_code) return;
    try {
      navigator.clipboard.writeText(deviceInfo.user_code);
    } catch {
      /* clipboard unavailable on some platforms */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center h-full w-full relative overflow-hidden">
      <div className="grid-bg" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-md px-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-[var(--border)] flex items-center justify-center mb-8">
          <span className="text-2xl font-bold tracking-tighter shimmer-text">RT</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2">RigTree Fetch</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed max-w-xs">
          Scan your hardware specs and share them on RigTree — from CPU to case fans, in a single click.
        </p>

        {phase === "idle" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={startLogin}
            className="btn-primary text-sm px-6 py-3"
          >
            <Github size={16} />
            Sign in with GitHub
          </motion.button>
        )}

        {phase === "requesting" && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin" />
            Connecting to GitHub…
          </div>
        )}

        {phase === "waiting" && deviceInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Enter this code at{" "}
              <button
                onClick={() => open(deviceInfo.verification_uri)}
                className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                github.com/login/device <ExternalLink size={10} />
              </button>
            </p>

            <button
              onClick={copyCode}
              className="card w-full py-5 px-6 flex items-center justify-center gap-3 group hover:border-[var(--accent)] transition-colors cursor-pointer"
            >
              <span className="text-3xl font-mono font-bold tracking-[0.3em] text-[var(--text-primary)]">
                {deviceInfo.user_code}
              </span>
              {copied ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Copy size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]" />
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-5 text-xs text-[var(--text-muted)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
              Waiting for authorization…
            </div>
          </motion.div>
        )}

        {phase === "authenticating" && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin" />
            Fetching your profile…
          </div>
        )}

        {phase === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={16} />
              {error || "Authentication failed"}
            </div>
            <button onClick={() => { setPhase("idle"); setError(""); }} className="btn-secondary text-xs">
              Try again
            </button>
          </motion.div>
        )}

        <p className="text-[0.625rem] text-[var(--text-muted)] mt-10 max-w-xs leading-relaxed">
          We only request permissions needed to open a PR on your behalf. Your data lives in a public GitHub repo — no databases, no tracking.
        </p>
      </motion.div>
    </div>
  );
}
