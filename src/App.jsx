import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import Store from './pages/Store.jsx'
import Profile from './pages/Profile.jsx'
import StoreGifts from './pages/StoreGifts.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/store" element={<Store />} />
        <Route path="/store/gifts" element={<StoreGifts />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
