import { Link, useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import GiftCard from '../components/GiftCard.jsx'
import GiftPreviewModal from '../components/GiftPreviewModal.jsx'
import { storeGifts } from '../data/catalog.js'

function StoreGifts() {
  const { currentUser, openAuthModal, balance, addGift, inventory } = useOutletContext()
  const [giftMessage, setGiftMessage] = useState('')
  const [activeGift, setActiveGift] = useState(null)

  const handleGiftBuy = (gift) => {
    if (!currentUser) {
      openAuthModal()
      return
    }
    const result = addGift(gift)
    if (!result.ok && result.reason === 'balance') {
      setGiftMessage('Not enough CC to buy this gift yet.')
    } else if (result.ok) {
      setGiftMessage('Gift added to your inventory.')
    }
    if (result.ok || result.reason === 'balance') {
      setTimeout(() => setGiftMessage(''), 1600)
    }
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="tabs">
          <Link className="tab" to="/store">
            Get CC
          </Link>
          <span className="tab active">Buy Gifts</span>
        </div>
        <div className="gift-section-header">
          <p className="section-title">Gift Effects</p>
          <span className="gift-count">{inventory.length} owned</span>
        </div>
        <p className="subtext">
          Buy animations, confetti, and floating emoji effects to enrich the card experience.
        </p>
        {giftMessage ? <p className="form-error">{giftMessage}</p> : null}
        <div className="gift-grid">
          {storeGifts.map((gift, index) => (
            <button
              key={`${gift.title}-${index}`}
              type="button"
              className="gift-button"
              onClick={() => setActiveGift(gift)}
            >
              <GiftCard {...gift} variant={`v${(index % 4) + 1}`} />
            </button>
          ))}
        </div>
      </div>
      <ScreenNav />
      <GiftPreviewModal
        gift={activeGift}
        onClose={() => setActiveGift(null)}
        onBuy={() => {
          if (!activeGift) return
          handleGiftBuy(activeGift)
          setActiveGift(null)
        }}
        disabled={activeGift ? activeGift.cc > balance : false}
        autoPreview
      />
    </div>
  )
}

export default StoreGifts
