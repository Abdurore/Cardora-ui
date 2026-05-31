export function getChatFrameId(frame) {
  if (!frame) return ''
  if (typeof frame === 'string') return frame
  if (typeof frame !== 'object') return ''
  return String(
    frame.id ||
    frame._id ||
    frame.frameId ||
    frame.chatFrameId ||
    frame.slug ||
    '',
  )
}

export function getChatFrameUrl(source) {
  if (!source || typeof source !== 'object') return ''
  const image = source.image && typeof source.image === 'object'
    ? source.image.url || source.image.secure_url || source.image.secureUrl
    : source.image
  return (
    source.url ||
    source.imageUrl ||
    image ||
    source.assetUrl ||
    source.asset?.url ||
    source.asset?.secure_url ||
    source.asset?.secureUrl ||
    source.asset?.imageUrl ||
    source.cloudinaryUrl ||
    source.secure_url ||
    source.secureUrl ||
    source.mediaUrl ||
    source.fileUrl ||
    source.file?.url ||
    source.file?.secure_url ||
    source.file?.secureUrl ||
    source.previewUrl ||
    source.thumbnailUrl ||
    source.frameUrl ||
    source.chatFrameUrl ||
    source.equippedChatFrameUrl ||
    source.equippedFrameUrl ||
    source.chatFrame?.url ||
    source.chatFrame?.imageUrl ||
    source.chatFrame?.frameUrl ||
    source.equippedChatFrame?.url ||
    source.equippedChatFrame?.imageUrl ||
    source.equippedChatFrame?.frameUrl ||
    source.equippedFrame?.url ||
    source.equippedFrame?.imageUrl ||
    source.equippedFrame?.frameUrl ||
    source.user?.chatFrameUrl ||
    source.user?.equippedChatFrameUrl ||
    source.user?.chatFrame?.url ||
    source.user?.chatFrame?.imageUrl ||
    source.user?.equippedChatFrame?.url ||
    source.user?.equippedChatFrame?.imageUrl ||
    ''
  )
}

export function normalizeChatFrame(frame) {
  if (!frame || typeof frame !== 'object') return null
  const id = getChatFrameId(frame)
  const url = getChatFrameUrl(frame)
  if (!id || !url) return null
  return {
    ...frame,
    id,
    url,
    imageUrl: frame.imageUrl || url,
    name: frame.name || frame.title || 'Chat Frame',
    price: frame.price ?? frame.priceCC ?? frame.cost ?? 0,
    desc: frame.description || frame.desc || '',
  }
}

export function getEquippedChatFrameId(user) {
  if (!user || typeof user !== 'object') return ''
  return String(
    user.chatFrameId ||
    user.equippedChatFrameId ||
    user.equippedFrameId ||
    getChatFrameId(user.chatFrame) ||
    getChatFrameId(user.equippedChatFrame) ||
    getChatFrameId(user.equippedFrame) ||
    '',
  )
}

export function getOwnedChatFrameIds(user) {
  if (!user || typeof user !== 'object') return []
  const lists = [
    user.chatFrames,
    user.purchasedChatFrames,
    user.ownedChatFrames,
    user.unlockedFrames,
    user.unlockedChatFrames,
    user.inventory?.chatFrames,
  ]
  return lists
    .filter(Array.isArray)
    .flat()
    .map(getChatFrameId)
    .filter(Boolean)
}

export function getLocalEquippedChatFrameId(userId) {
  if (!userId) return null
  try {
    return localStorage.getItem(`cardora:equippedChatFrame:${userId}`)
  } catch {
    return null
  }
}

export function setLocalEquippedChatFrameId(userId, frameId) {
  if (!userId) return
  try {
    const key = `cardora:equippedChatFrame:${userId}`
    if (frameId) localStorage.setItem(key, frameId)
    else localStorage.setItem(key, '__frameless__')
  } catch { /* storage can be unavailable */ }
}
