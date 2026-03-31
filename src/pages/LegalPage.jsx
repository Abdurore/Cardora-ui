import { Link, Navigate, useParams } from 'react-router-dom'
import { legalDocs } from '../data/legalDocs.js'

function LegalPage() {
  const { doc = '' } = useParams()
  const legalDoc = legalDocs[doc]

  if (!legalDoc) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="auth-page legal-page">
      <div className="auth-page-bg" aria-hidden="true" />
      <div className="legal-page-shell auth-card">
        <div className="legal-page-header">
          <Link className="auth-page-back" to="/signup">
            Back
          </Link>
          <p className="eyebrow">Legal</p>
          <h1>{legalDoc.title}</h1>
          <p className="legal-page-updated">Last updated {legalDoc.updated}</p>
        </div>

        <div className="legal-page-links">
          {Object.entries(legalDocs).map(([key, item]) => (
            <Link
              key={key}
              className={`legal-page-link ${key === doc ? 'active' : ''}`}
              to={`/legal/${key}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="legal-page-content">
          {legalDoc.sections.map((section) => (
            <section className="auth-legal-section" key={section.heading}>
              <h4>{section.heading}</h4>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LegalPage
