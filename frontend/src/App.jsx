import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Header from './components/Header'
import LoadingSpinner from './components/LoadingSpinner'

const Home = lazy(() => import('./pages/Home'))
const SenderPage = lazy(() => import('./pages/SenderPage'))
const ReceiverPage = lazy(() => import('./pages/ReceiverPage'))

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-slate-400 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="pt-16">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner label="Loading…" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send" element={<SenderPage />} />
            <Route path="/join/:roomId" element={<ReceiverPage />} />
            <Route path="/join" element={<ReceiverPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  )
}

