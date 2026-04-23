// src/components/Layout.jsx
import { NavLink } from 'react-router-dom'
import { LayoutList, TrendingUp, Upload, Sparkles, Settings } from 'lucide-react'

const NAV = [
  { to: '/',            icon: LayoutList, label: 'Ledger'      },
  { to: '/forecast',    icon: TrendingUp, label: 'Forecast'    },
  { to: '/import',      icon: Upload,     label: 'Import'      },
  { to: '/suggestions', icon: Sparkles,   label: 'Suggestions' },
  { to: '/settings',    icon: Settings,   label: 'Settings'    },
]

function NavItem({ to, icon: Icon, label, sidebar }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        sidebar
          ? `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-navy-800 text-white'
                : 'text-navy-300 hover:bg-navy-800/60 hover:text-white'
            }`
          : `flex-1 flex flex-col items-center pt-2 pb-1 text-[11px] font-medium transition-colors ${
              isActive
                ? 'text-navy-600 dark:text-navy-300'
                : 'text-slate-400 dark:text-slate-500'
            }`
      }
    >
      <Icon size={sidebar ? 17 : 22} strokeWidth={1.8} />
      <span className={sidebar ? '' : 'mt-0.5'}>{label}</span>
    </NavLink>
  )
}

export default function Layout({ children }) {
  return (
    <div className="flex h-svh" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Desktop sidebar (always dark navy, unchanged) ─── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-navy-900 border-r border-navy-950">
        <div className="px-5 py-6 border-b border-navy-800">
          <p className="font-serif text-xl text-white tracking-wide">CashFlow</p>
          <p className="text-navy-400 text-xs mt-0.5">Forecast &amp; Plan</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(n => <NavItem key={n.to} {...n} sidebar />)}
        </nav>
        <div className="p-4 border-t border-navy-800 text-navy-500 text-xs">
          Data stored locally
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto overscroll-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ───────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex
                   border-t border-slate-200 dark:border-slate-700
                   bg-white dark:bg-slate-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(n => <NavItem key={n.to} {...n} sidebar={false} />)}
      </nav>

      {/* Spacer behind mobile bottom nav */}
      <div className="md:hidden h-16" />
    </div>
  )
}
