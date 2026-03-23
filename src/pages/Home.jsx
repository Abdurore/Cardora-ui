import { useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { homeCards } from '../data/catalog.js'

function Home() {
  const { openExperience } = useOutletContext()

  return (
    <div className="page-section">
      <h2 className="page-title">Cardora</h2>
      <header className="topbar">
        <div>
          <p className="eyebrow">Cardora Web</p>
          <h1>Send stunning cards to people you love</h1>
          <p className="subtext">
            A neon-lit card marketplace for birthdays, proposals, anniversaries, and
            every tiny moment that deserves a spark.
          </p>
        </div>
        <div className="cta-row">
          <button className="primary">Start a card</button>
          <button className="ghost">Browse templates</button>
        </div>
      </header>

      <div className="page-body">
        <ScreenHeader />
        <div className="screen-body">
          <div className="card-grid">
            {homeCards.map((card, index) => (
              <CardItem
                key={`${card.title}-${index}`}
                {...card}
                variant={`v${(index % 4) + 1}`}
                onClick={openExperience}
              />
            ))}
          </div>
        </div>
        <ScreenNav />
      </div>
    </div>
  )
}

export default Home
