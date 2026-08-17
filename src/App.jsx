import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'

// Route-level code splitting — previously every page shipped in one ~1.1MB
// bundle regardless of which route a visitor actually landed on. Each page
// now loads on demand instead.
const Home = lazy(() => import('./pages/Home.jsx'))
const Explore = lazy(() => import('./pages/Explore.jsx'))
const Artists = lazy(() => import('./pages/Artists.jsx'))
const Store = lazy(() => import('./pages/Store.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const CardView = lazy(() => import('./pages/CardView.jsx'))
const CardStudio = lazy(() => import('./pages/CardStudio.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))
const ModeratorDashboard = lazy(() => import('./pages/ModeratorDashboard.jsx'))
const EnterpriseDashboard = lazy(() => import('./pages/EnterpriseDashboard.jsx'))
const ArtistDashboard = lazy(() => import('./pages/ArtistDashboard.jsx'))
const WorldChat = lazy(() => import('./pages/WorldChat.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'))
const AnonSend = lazy(() => import('./pages/AnonSend.jsx'))
const CreateCardPicker = lazy(() => import('./pages/CreateCardPicker.jsx'))
const CardResponses = lazy(() => import('./pages/CardResponses.jsx'))
const QuickCreate = lazy(() => import('./pages/QuickCreate.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function RouteFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'rgba(232,241,244,0.5)' }}>
      Loading…
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/store" element={<Store />} />
          <Route path="/card/:id" element={<CardView />} />
          <Route path="/card/:slug/responses" element={<CardResponses />} />
          <Route path="/studio" element={<CardStudio />} />
          <Route path="/quick" element={<QuickCreate />} />
          <Route path="/create" element={<CreateCardPicker />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/moderator" element={<ModeratorDashboard />} />
          <Route path="/enterprise" element={<EnterpriseDashboard />} />
          <Route path="/artist" element={<ArtistDashboard />} />
          <Route path="/chat" element={<WorldChat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Public anonymous send page — outside MainLayout so no auth context required */}
        <Route path="/ask/:username" element={<AnonSend />} />
      </Routes>
    </Suspense>
  )
}

export default App
