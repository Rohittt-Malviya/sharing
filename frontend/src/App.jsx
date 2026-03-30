import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SenderPage from './pages/SenderPage'
import ReceiverPage from './pages/ReceiverPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/send" element={<SenderPage />} />
        <Route path="/join/:roomId" element={<ReceiverPage />} />
        <Route path="/join" element={<ReceiverPage />} />
      </Routes>
    </BrowserRouter>
  )
}
