import { Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import Layout from './components/Layout'
import Inbox from './pages/Inbox'
import NewRequest from './pages/NewRequest'
import MyRequests from './pages/MyRequests'
import History from './pages/History'
import RequestDetail from './pages/RequestDetail'

function Routed() {
  const { loading, currentUser } = useStore()

  if (loading || !currentUser) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Cargando CeoDesk…
      </div>
    )
  }

  const home = currentUser.role === 'ceo' ? <Inbox /> : <Navigate to="/mis-solicitudes" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/nueva" element={<NewRequest />} />
        <Route path="/mis-solicitudes" element={<MyRequests />} />
        <Route path="/historial" element={<History />} />
        <Route path="/solicitud/:id" element={<RequestDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Routed />
    </StoreProvider>
  )
}
