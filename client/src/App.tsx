import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ApsViewerPage } from './pages/ApsViewerPage'
import { HomePage } from './pages/HomePage'
import { ThreeDemoPage } from './pages/ThreeDemoPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="three" element={<ThreeDemoPage />} />
        <Route path="aps" element={<ApsViewerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
