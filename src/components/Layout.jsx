import { Monitor, Send, LogOut, Github } from "lucide-react";
import useStore from "../store/useStore";

const IS_MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);

const NAV_ITEMS = [
  { id: "editor", label: "Hardware", icon: Monitor },
  { id: "submit", label: "Submit", icon: Send },
];

export default function Layout({ children }) {
  const { user, currentPage, setPage, logout } = useStore();

  if (IS_MOBILE) {
    return (
      <div className="flex flex-col h-full w-full">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-[0.5rem] font-bold text-white/80">RT</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              RigTree
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full border border-[var(--border)]"
              />
              <button onClick={logout} className="btn-ghost p-1.5">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>

        <nav className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] safe-area-bottom">
          <div className="flex">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[0.6rem] font-medium transition-colors ${
                  currentPage === id
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Icon size={18} strokeWidth={currentPage === id ? 2 : 1.5} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <aside className="glass-sidebar w-52 flex-shrink-0 flex flex-col h-full">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-[0.55rem] font-bold text-white/80">RT</span>
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-tight text-[var(--text-primary)]">
                RigTree
              </h1>
              <p className="text-[0.55rem] font-mono tracking-wider text-[var(--text-muted)] uppercase">
                Fetch
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
                currentPage === id
                  ? "bg-white/[0.07] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]"
              }`}
            >
              <Icon size={14} strokeWidth={currentPage === id ? 2 : 1.5} />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-[var(--border-subtle)]" />

        <div className="p-2">
          {user && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1.5">
              <img
                src={user.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full border border-[var(--border)]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[0.65rem] font-medium text-[var(--text-primary)] truncate">
                  {user.name || user.login}
                </p>
                <p className="text-[0.55rem] text-[var(--text-muted)] truncate flex items-center gap-1">
                  <Github size={8} />
                  {user.login}
                </p>
              </div>
            </div>
          )}
          <button onClick={logout} className="btn-ghost w-full text-[0.65rem] justify-start">
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
