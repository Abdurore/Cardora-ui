import { useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import searchIcon from '../assets/icons/search.png'
import { exploreCards, exploreTags } from '../data/catalog.js'

function Explore() {
  const { openExperience } = useOutletContext()

  return (
    <div className="page-body">
      <ScreenHeader />
      <div className="screen-body">
        <div className="search">
          <img className="search-icon" src={searchIcon} alt="" aria-hidden="true" />
          <input placeholder="Search templates, music, effects" />
        </div>
        <div className="tag-list">
          {exploreTags.map((tag) => (
            <button key={tag.label} className="tag">
              {tag.label} <span>({tag.count})</span>
            </button>
          ))}
        </div>
        <div className="card-grid compact">
          {exploreCards.map((card, index) => (
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
  )
}

export default Explore
