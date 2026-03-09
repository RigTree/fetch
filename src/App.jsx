import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import useStore from "./store/useStore";
import Titlebar from "./components/Titlebar";
import Stepper from "./components/Stepper";
import Scan from "./pages/Scan";
import Editor from "./pages/Editor";
import Submit from "./pages/Submit";

export default function App() {
  const { currentStep, profileData, setStep, setSession } = useStore();

  useEffect(() => {
    if (profileData && currentStep === "scan") {
      setStep("edit");
    }
  }, []);

  useEffect(() => {
    const applyUrls = (urls) => {
      if (!urls || !urls.length) return;
      for (const raw of urls) {
        try {
          const url = new URL(raw);
          if (url.protocol !== "rigtree:") continue;
          // Format: rigtree://fetch?endpoint=...&type=computer
          const host = url.hostname || "";
          const path = url.pathname || "";
          if (host !== "fetch" && !path.startsWith("/fetch")) continue;
          const endpoint = url.searchParams.get("endpoint");
          const type = url.searchParams.get("type") || "computer";
          if (endpoint) {
            setSession(endpoint, type);
            // Ensure we start at scan so flow is: fetch → edit → submit
            setStep("scan");
            break;
          }
        } catch {
          // ignore malformed URLs
        }
      }
    };

    (async () => {
      try {
        const startUrls = await getCurrent();
        if (startUrls) applyUrls(startUrls);
        await onOpenUrl((urls) => {
          applyUrls(urls);
        });
      } catch {
        // deep-link plugin not available (e.g. plain web build)
      }
    })();
  }, [setSession, setStep]);

  const renderStep = () => {
    switch (currentStep) {
      case "scan":
        return <Scan key="scan" />;
      case "edit":
        return <Editor key="edit" />;
      case "submit":
        return <Submit key="submit" />;
      default:
        return <Scan key="scan" />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Titlebar />
      <Stepper currentStep={currentStep} />
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
      </div>
    </div>
  );
}
