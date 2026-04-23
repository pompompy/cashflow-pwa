import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout          from './components/Layout'
import LedgerPage      from './pages/LedgerPage'
import ForecastPage    from './pages/ForecastPage'
import ImportPage      from './pages/ImportPage'
import SuggestionsPage from './pages/SuggestionsPage'
import SettingsPage    from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Routes>
          <Route path="/"            element={<LedgerPage />} />
          <Route path="/forecast"    element={<ForecastPage />} />
          <Route path="/import"      element={<ImportPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/settings"    element={<SettingsPage />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}
