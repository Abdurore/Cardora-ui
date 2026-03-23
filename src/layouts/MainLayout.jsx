import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import CardExperience from '../components/CardExperience.jsx'
import layoutData from '../data/layoutData.js'
import '../App.css'

function MainLayout() {
  const [showExperience, setShowExperience] = useState(false)

  return (
    <div className="page">
      <Outlet context={{ openExperience: () => setShowExperience(true) }} />

      {showExperience ? (
        <CardExperience data={layoutData} onClose={() => setShowExperience(false)} />
      ) : null}
    </div>
  )
}

export default MainLayout
