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
          : `flex-1 flex flex-col items-center justify-center pt-2 pb-1 text-[11px] font-medium transition-colors ${
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
    <div className="app-shell flex flex-col md:flex-row" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
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

      {/*
        Column shell: main scrolls; tab bar in document flow at the bottom.
        FAB anchors to the tab bar wrapper (bottom: 100%), so it cannot sit
        under the nav or depend on measured heights / visualViewport.
      */}
      <div className="flex-1 flex flex-col min-h-0">
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-none">
          {children}
        </main>

        <div className="relative shrink-0 md:hidden">
          {/* Sits just above the tab bar — bottom:100% of this wrapper */}
          <div
            id="fab-root"
            className="pointer-events-none absolute right-4 z-40"
            style={{ bottom: 'calc(100% + 0.75rem)' }}
          />
          <nav
            data-tabbar
            className="tabbar-flow flex
                       border-t border-slate-200 dark:border-slate-700
                       bg-white dark:bg-slate-900"
          >
            {NAV.map(n => <NavItem key={n.to} {...n} sidebar={false} />)}
          </nav>
        </div>
      </div>
    </div>
  )
}
