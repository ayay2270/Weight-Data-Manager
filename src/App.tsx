import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { DataProvider } from './hooks/useData'
import { DashboardPage } from './pages/DashboardPage'
import { ImportExportPage } from './pages/ImportExportPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WeightDataPage } from './pages/WeightDataPage'

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <div className="app-shell">
          <Sidebar />
          <main className="main">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/weight-data" element={<WeightDataPage />} />
              <Route path="/import-export" element={<ImportExportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </DataProvider>
  )
}
