import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SenderPage from './pages/SenderPage'
import ReceiverPage from './pages/ReceiverPage'
import Header from './components/Header'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/send" element={<SenderPage />} />
          <Route path="/join/:roomId" element={<ReceiverPage />} />
          <Route path="/join" element={<ReceiverPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

