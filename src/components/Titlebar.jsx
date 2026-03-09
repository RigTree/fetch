import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

const IS_MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);

let appWindow = null;
try {
  appWindow = getCurrentWindow();
} catch {
  // Not running in Tauri context
}

export default function Titlebar() {
  if (IS_MOBILE || !appWindow) return null;

  return (
    <div data-tauri-drag-region className="titlebar">
      <div data-tauri-drag-region className="titlebar-title">
        <div className="titlebar-icon">
          <span>RT</span>
        </div>
        <span className="titlebar-label">RigTree Fetch</span>
      </div>
      <div className="titlebar-controls">
        <button
          onClick={() => appWindow.minimize()}
          className="titlebar-btn"
          tabIndex={-1}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="titlebar-btn"
          tabIndex={-1}
        >
          <Square size={9} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="titlebar-btn titlebar-btn-close"
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
