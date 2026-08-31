// 7.13: fixed colors on purpose, not a missed token conversion -- this is
// the fallback theme/content for a card whose own layoutdata is missing
// (see CardView.jsx), i.e. card-render data, not app chrome. A card's
// palette must never react to the viewer's site theme, default or not.
const layoutData = {
  theme: {
    background: 'linear-gradient(160deg, rgba(10, 18, 25, 0.98), rgba(8, 18, 22, 0.98))',
    overlay: 'rgba(6, 12, 14, 0.55)',
    cardGlow: '0 0 40px rgba(109, 255, 175, 0.25)',
    border: 'linear-gradient(120deg, rgba(126, 247, 255, 0.6), rgba(255, 153, 205, 0.4))',
  },
  typography: {
    title: '"Cinzel", serif',
    body: '"Manrope", sans-serif',
  },
  accents: {
    primary: '#7ef7ff',
    secondary: '#ff9bd2',
    positive: '#62ffa2',
    neutral: 'rgba(215, 240, 246, 0.7)',
  },
  motion: {
    entrance: 'card-fade 0.9s ease both',
  },
  content: {
    header: 'A message for you',
    preview: 'There is a little story inside, wrapped with a spark of neon.',
    openCta: 'Open',
    title: 'Forever Starts Tonight',
    message:
      'Every beat of our journey has been a soft glow leading to this moment. I made this just for you.',
    extra:
      'And if you are smiling right now, know that every detail is a reminder of how cherished you are.',
    question: 'Will you marry me?',
    yes: 'Yes',
    no: 'Not yet',
  },
}

export default layoutData
