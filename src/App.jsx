import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import Store from './pages/Store.jsx'
import Profile from './pages/Profile.jsx'
import StoreGifts from './pages/StoreGifts.jsx'
import CardView from './pages/CardView.jsx'
import CardStudio from './pages/CardStudio.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/store" element={<Store />} />
        <Route path="/store/gifts" element={<StoreGifts />} />
        <Route path="/card/:id" element={<CardView />} />
        <Route path="/studio" element={<CardStudio />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
