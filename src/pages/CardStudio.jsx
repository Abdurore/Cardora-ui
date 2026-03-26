import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/icons/logo.png'

function CardStudio() {
  const navigate = useNavigate()
  const location = useLocation()
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])

  const [activePanel, setActivePanel] = useState('theme')
  const [activeSlide, setActiveSlide] = useState('cover')
  const [title, setTitle] = useState(cardData?.title || 'My Cardora Card')
  const [recipient, setRecipient] = useState('Alex')
  const [showImage, setShowImage] = useState(true)

  const leftTabs = [
    { id: 'theme', label: 'Theme' },
    { id: 'effects', label: 'Effects' },
    { id: 'sound', label: 'Sound' },
  ]

  const slides = [
    { id: 'cover', title: 'Cover', subtitle: 'Slides: 1-2' },
    { id: 'message', title: 'Message', subtitle: 'Slides: 1-2' },
  ]

  const addItems = [
    { label: 'Photo' },
    { label: 'Message' },
    { label: 'Countdown' },
    { label: 'Video' },
    { label: 'Quote' },
    { label: 'Gift Card' },
    { label: 'Text' },
    { label: 'Audio' },
    { label: 'Location Map' },
  ]

  return (
    <div className="page-body">
      <style>{`
        .studio-root {
          display: grid;
          gap: 18px;
        }
        .studio-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 18px;
          border-radius: 18px;
          border: 1px solid rgba(92, 231, 242, 0.18);
          background: linear-gradient(180deg, rgba(8, 16, 20, 0.85), rgba(6, 12, 14, 0.9));
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
        }
        .studio-top-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .studio-logo {
          width: 30px;
          height: 30px;
          filter: drop-shadow(0 0 12px rgba(98, 255, 162, 0.7));
        }
        .studio-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 12px;
          border: 1px solid rgba(92, 231, 242, 0.2);
          background: rgba(8, 16, 20, 0.7);
          font-size: 0.8rem;
          color: rgba(216, 242, 247, 0.8);
        }
        .studio-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .studio-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 12px;
          border: 1px solid rgba(92, 231, 242, 0.25);
          background: rgba(8, 16, 20, 0.7);
          color: rgba(216, 242, 247, 0.85);
          font-size: 0.75rem;
        }
        .studio-action.primary {
          background: linear-gradient(120deg, #5ce7f2, #62ffa2);
          color: #041015;
          border: none;
        }
        .studio-layout {
          display: grid;
          grid-template-columns: minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 320px);
          gap: 18px;
          align-items: start;
        }
        .studio-panel {
          border: 1px solid rgba(92, 231, 242, 0.15);
          background: rgba(7, 14, 17, 0.85);
          border-radius: 20px;
          padding: 14px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        }
        .studio-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }
        .studio-tab {
          flex: 1;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(92, 231, 242, 0.2);
          background: rgba(8, 16, 20, 0.6);
          color: rgba(216, 242, 247, 0.75);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .studio-tab.active {
          border-color: rgba(98, 255, 162, 0.6);
          color: #62ffa2;
          box-shadow: 0 0 12px rgba(98, 255, 162, 0.2);
        }
        .studio-slide {
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(92, 231, 242, 0.18);
          background: rgba(8, 16, 20, 0.65);
          display: grid;
          gap: 4px;
          text-align: left;
        }
        .studio-slide.active {
          border-color: rgba(98, 255, 162, 0.6);
          box-shadow: 0 0 12px rgba(98, 255, 162, 0.2);
        }
        .studio-add-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        .studio-add {
          border-radius: 12px;
          border: 1px solid rgba(92, 231, 242, 0.18);
          background: rgba(8, 16, 20, 0.6);
          padding: 10px 6px;
          font-size: 0.7rem;
          color: rgba(216, 242, 247, 0.75);
        }
        .studio-center {
          border-radius: 24px;
          border: 1px solid rgba(92, 231, 242, 0.15);
          background: radial-gradient(circle at top, rgba(98, 255, 162, 0.1), transparent 60%),
            rgba(8, 16, 20, 0.85);
          padding: 22px;
          display: grid;
          place-items: center;
          min-height: 560px;
          position: relative;
          overflow: hidden;
        }
        .studio-stars {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(98, 255, 162, 0.6) 1px, transparent 1px);
          background-size: 80px 80px;
          opacity: 0.3;
        }
        .studio-phone {
          width: min(320px, 80vw);
          aspect-ratio: 9 / 16;
          border-radius: 26px;
          border: 1px solid rgba(98, 255, 162, 0.5);
          background: rgba(6, 12, 14, 0.85);
          box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.6);
          display: grid;
          place-items: center;
          position: relative;
          z-index: 1;
        }
        .studio-envelope {
          width: 55%;
          aspect-ratio: 1.1;
          position: relative;
          display: grid;
          place-items: center;
        }
        .envelope-back {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background: linear-gradient(160deg, #62ffa2, #2bd9c3);
          filter: drop-shadow(0 0 12px rgba(98, 255, 162, 0.5));
        }
        .envelope-front {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background: linear-gradient(160deg, rgba(20, 70, 55, 0.9), rgba(8, 16, 20, 0.9));
          border: 1px solid rgba(98, 255, 162, 0.4);
          clip-path: polygon(0 0, 100% 0, 50% 58%);
        }
        .envelope-card {
          width: 70%;
          height: 55%;
          border-radius: 8px;
          background: rgba(230, 240, 245, 0.95);
          display: grid;
          place-items: center;
          font-size: 0.65rem;
          color: rgba(6, 12, 14, 0.8);
        }
        .studio-dots {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
        }
        .studio-dot {
          width: 22px;
          height: 6px;
          border-radius: 999px;
          background: rgba(98, 255, 162, 0.3);
        }
        .studio-dot.active {
          background: rgba(98, 255, 162, 0.8);
        }
        .studio-right-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(98, 255, 162, 0.7);
          margin: 0 0 12px;
        }
        .studio-field {
          display: grid;
          gap: 6px;
          margin-bottom: 12px;
        }
        .studio-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(92, 231, 242, 0.2);
          background: rgba(8, 16, 20, 0.7);
          margin-bottom: 12px;
        }
        .toggle-pill {
          width: 44px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(92, 231, 242, 0.35);
          background: rgba(10, 18, 22, 0.8);
          display: flex;
          align-items: center;
          padding: 2px;
        }
        .toggle-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #5ce7f2;
          transform: translateX(0);
          transition: transform 0.2s ease;
        }
        .toggle-pill.on .toggle-dot {
          transform: translateX(20px);
          background: #62ffa2;
        }
        .studio-image {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(92, 231, 242, 0.2);
          background: rgba(8, 16, 20, 0.7);
          aspect-ratio: 4 / 3;
          display: grid;
          place-items: center;
          color: rgba(216, 242, 247, 0.6);
          font-size: 0.75rem;
        }
        @media (max-width: 960px) {
          .studio-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="screen-body studio-root">
        <p className="page-title" style={{ margin: 0, textAlign: 'left' }}>Cardora Studio</p>
        <div className="studio-topbar">
          <div className="studio-top-left">
            <img src={logo} alt="Cardora logo" className="studio-logo" />
            <div className="studio-search">New Here</div>
          </div>
          <div className="studio-actions">
            <button className="studio-action" type="button">Templates</button>
            <button className="studio-action" type="button">Preview</button>
            <button className="studio-action primary" type="button">Go Live</button>
          </div>
        </div>

        <div className="studio-layout">
          <div className="studio-panel">
            <div className="studio-tabs">
              {leftTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`studio-tab ${activePanel === tab.id ? 'active' : ''}`}
                  onClick={() => setActivePanel(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {slides.map((slide) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`studio-slide ${activeSlide === slide.id ? 'active' : ''}`}
                  onClick={() => setActiveSlide(slide.id)}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>{slide.title}</p>
                  <p className="subtext" style={{ margin: 0 }}>{slide.subtitle}</p>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '18px' }}>
              <p className="section-title">Add slide</p>
              <div className="studio-add-grid">
                {addItems.map((item) => (
                  <button key={item.label} type="button" className="studio-add">
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="studio-center">
            <div className="studio-stars" />
            <div className="studio-phone">
              <div className="studio-envelope">
                <div className="envelope-back" />
                <div className="envelope-card">QR</div>
                <div className="envelope-front" />
              </div>
              <div className="studio-dots">
                <span className="studio-dot active" />
                <span className="studio-dot" />
              </div>
            </div>
          </div>

          <div className="studio-panel">
            <p className="studio-right-title">Card Properties</p>
            <div className="studio-field">
              <label className="eyebrow">Title</label>
              <input className="search" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="studio-field">
              <label className="eyebrow">Recipient Name</label>
              <input
                className="search"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
            </div>
            <div className="studio-toggle">
              <span className="subtext">Show Image</span>
              <button
                className={`toggle-pill ${showImage ? 'on' : ''}`}
                type="button"
                onClick={() => setShowImage((prev) => !prev)}
              >
                <span className="toggle-dot" />
              </button>
            </div>
            <div className="studio-image">{showImage ? 'Cardora' : 'Hidden'}</div>
            <button className="ghost" type="button" style={{ width: '100%', marginTop: '12px' }}>
              Upload Image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardStudio
