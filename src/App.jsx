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
import ModeratorDashboard from './pages/ModeratorDashboard.jsx'
import EnterpriseDashboard from './pages/EnterpriseDashboard.jsx'
import WorldChat from './pages/WorldChat.jsx'
import AuthPage from './pages/AuthPage.jsx'
import LegalPage from './pages/LegalPage.jsx'
import AnonSend from './pages/AnonSend.jsx'
import AnonInbox from './pages/AnonInbox.jsx'
import CreateCardPicker from './pages/CreateCardPicker.jsx'
import CardResponses from './pages/CardResponses.jsx'
import QuickCreate from './pages/QuickCreate.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/store" element={<Store />} />
        <Route path="/store/gifts" element={<StoreGifts />} />
        <Route path="/card/:id" element={<CardView />} />
        <Route path="/card/:slug/responses" element={<CardResponses />} />
        <Route path="/studio" element={<CardStudio />} />
        <Route path="/quick" element={<QuickCreate />} />
        <Route path="/create" element={<CreateCardPicker />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/moderator" element={<ModeratorDashboard />} />
        <Route path="/enterprise" element={<EnterpriseDashboard />} />
        <Route path="/chat" element={<WorldChat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/legal/:doc" element={<LegalPage />} />
        <Route path="/inbox" element={<AnonInbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      {/* Public anonymous send page — outside MainLayout so no auth context required */}
      <Route path="/ask/:username" element={<AnonSend />} />
    </Routes>
  )
}

export default App
