import { NavLink, useLocation } from 'react-router-dom'
import { Home, Compass, Plus, Bell, User } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SidebarProps {
  className?: string
  onCreateClick?: () => void
}

export function Sidebar({ className, onCreateClick }: SidebarProps) {
  const location = useLocation()
  const isCreateActive = location.pathname === '/create' || location.pathname === '/create-drive'

  return (
    <aside
      aria-label="Desktop navigation"
      className={cn(
        'w-[240px] h-screen fixed left-0 top-0 z-40',
        'bg-navy-900 text-white flex flex-col justify-between p-4 select-none',
        className,
      )}
    >
      {/* ── Top section: Logo & Nav List ─────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Logo (droplet icon + wordmark) */}
        <NavLink
          to="/home"
          className="flex items-center gap-3 px-2 py-2 rounded-input hover:bg-white/5 transition-colors"
          aria-label="ReliefLink Home"
        >
          <div className="w-9 h-9 rounded-input bg-brand-600 flex items-center justify-center shrink-0 shadow-sm">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              <path
                d="M12 12.5a2.5 2.5 0 0 0-2.5 2.5c0 1.5 2.5 3.5 2.5 3.5s2.5-2 2.5-3.5a2.5 2.5 0 0 0-2.5-2.5z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="text-h3 font-bold text-white tracking-tight">ReliefLink</span>
        </NavLink>

        {/* Vertical nav list */}
        <nav aria-label="Sidebar main links" className="flex flex-col gap-1.5">
          {/* Home */}
          <NavLink
            to="/home"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <Home className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Home</span>
          </NavLink>

          {/* Browse */}
          <NavLink
            to="/browse"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <Compass className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Browse</span>
          </NavLink>

          {/* Create (triggers chooser modal) */}
          <button
            type="button"
            onClick={onCreateClick}
            className={cn(
              'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              isCreateActive
                ? 'bg-brand-600 text-white font-semibold shadow-sm'
                : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
            )}
            aria-label="Create item"
          >
            <Plus className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Create</span>
          </button>

          {/* Alerts */}
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <Bell className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Alerts</span>
            <span className="ml-auto px-2 py-0.5 rounded-pill bg-danger text-white text-[11px] font-bold leading-tight">
              3
            </span>
          </NavLink>

          {/* Profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <User className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Profile</span>
          </NavLink>
        </nav>
      </div>

      {/* ── Bottom section: User Card ────────────────────────────── */}
      <div className="pt-4 border-t border-white/10 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold text-caption shrink-0">
          PS
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-body font-semibold text-white truncate leading-tight">
            Priya Sharma
          </span>
          <span className="text-[12px] text-brand-100 font-medium">Donor</span>
        </div>
      </div>
    </aside>
  )
}
