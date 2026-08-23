// 6.5: "Send one back" -- pulled out of CardPreviewModal.jsx (a component
// file, where a non-component export trips react-refresh/only-export-
// components) so the query-string construction can be unit tested
// directly, without driving the whole component through its 'end' stage.
export function buildSendOneBackPath(cardId, senderName) {
  return `/quick?type=personal&replyTo=${encodeURIComponent(cardId || '')}${senderName ? `&replySender=${encodeURIComponent(senderName)}` : ''}`
}
