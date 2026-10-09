import React from 'react';
import { getSettings } from '../../desktop/storage';
import ProfileAvatar from '../common/ProfileAvatar';
import './Home.css';

export type HomePreview = 'multiplayer' | 'towers';

interface HomeProps {
  onTraining: () => void;
  onDeckEditor: () => void;
  onCardDatabase: () => void;
  onRules: () => void;
  onSettings: () => void;
  onAccount: () => void;
  onShop: () => void;
  onPreview: (preview: HomePreview) => void;
}

const navigation = [
  { number: '01', label: 'MULTIPLAYER', detail: 'Play against other players', icon: 'fa-globe', kind: 'multiplayer', featured: true, badge: 'COMING SOON' },
  { number: '02', label: 'TRAINING', detail: 'Practice against the AI', icon: 'fa-crosshairs', kind: 'training', featured: true },
  { number: '03', label: 'TOWERS', detail: '[WORKING ON]', icon: 'fa-chess-rook', kind: 'towers', featured: true, badge: 'COMING SOON' },
  { number: '04', label: 'DECK EDITOR', detail: 'View your custom decks', icon: 'fa-layer-group', kind: 'deck' },
  { number: '05', label: 'SHOP', detail: 'Discover packs', icon: 'fa-bag-shopping', kind: 'shop' },
  { number: '06', label: 'CARD DATABASE', detail: 'View all cards in game', icon: 'fa-table-cells-large', kind: 'cards' },
  { number: '07', label: 'RULES', detail: 'Learn how to play', icon: 'fa-book-open', kind: 'rules' },
  { number: '08', label: 'SETTINGS', detail: 'Tweak audio & visuals', icon: 'fa-gear', kind: 'settings' },
] as const;

export default function Home({ onTraining, onDeckEditor, onCardDatabase, onRules, onSettings, onAccount, onShop, onPreview }: HomeProps) {
  const actions = {
    multiplayer: () => onPreview('multiplayer'),
    training: onTraining,
    deck: onDeckEditor,
    cards: onCardDatabase,
    towers: () => onPreview('towers'),
    shop: onShop,
    rules: onRules,
    settings: onSettings,
  };

  return <main className="home-screen">
    <div className="home-ambient" aria-hidden="true">
      <div className="home-grid-image" />
      <div className="home-scanline" />
      <div className="home-orbit home-orbit--outer" />
      <div className="home-orbit home-orbit--inner" />
      <div className="home-core"><span className="home-core__logo" /></div>
      <div className="home-card home-card--one" />
      <div className="home-card home-card--two" />
      <div className="home-card home-card--three" />
      <div className="home-spark home-spark--one">✦</div>
      <div className="home-spark home-spark--two">✦</div>
      <div className="home-spark home-spark--three">✦</div>
    </div>

    <header className="home-topbar">
      <div className="home-mark"><span className="home-mark__symbol" aria-hidden="true"><span /></span><span>PROJECT ENTITY <small>SIMULATION CARD GAME</small></span></div>
      <div className="home-topbar__right">
        <span className="home-build">ALPHA / 1.5.0</span>
        <button type="button" data-sound="select" className="home-account" onClick={onAccount}>
          <span className="home-account__avatar"><ProfileAvatar image={getSettings().profileImage} /></span>
          <span><small>ACCOUNT</small><strong>{getSettings().username}</strong></span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div className="home-main">
      <div className="home-left">
        <div className="home-heading">
          <span className="home-kicker"><span className="home-live-dot" /> Pending...</span>
          <h1>PROJECT <em>ENTITY</em></h1>
        </div>
        <nav aria-label="Main menu" className="home-navigation">
          {navigation.map(item => <button
            key={item.kind}
            type="button"
            data-sound="select"
            onClick={actions[item.kind]}
            className={`home-nav-button${'featured' in item ? ' home-nav-button--featured' : ''}${item.kind === 'multiplayer' ? ' home-nav-button--primary' : ''}`}
          >
            <span className="home-nav-button__number">{item.number}</span>
            <span className="home-nav-button__icon"><i className={`fa-solid ${item.icon}`} aria-hidden="true" /></span>
            <span className="home-nav-button__text"><strong>{item.label}</strong><small>{item.detail}</small></span>
            {'badge' in item && <span className="home-nav-button__badge">{item.badge}</span>}
            <span className="home-nav-button__arrow"><i className="fa-solid fa-arrow-up-right" aria-hidden="true" /></span>
          </button>)}
        </nav>
      </div>
    </div>
    <footer className="home-footer"><span>◈ &nbsp; </span><span> &nbsp; ◈</span></footer>
  </main>;
}

const previewDetails: Record<HomePreview, { label: string; icon: string }> = {
  multiplayer: { label: 'MULTIPLAYER', icon: 'fa-globe' },
  towers: { label: 'TOWERS', icon: 'fa-chess-rook' },
};

export function WorkInProgress({ feature, onBack }: { feature: HomePreview; onBack: () => void }) {
  const { label, icon } = previewDetails[feature];
  return <main className="work-screen">
    <div className="work-screen__panel">
      <span className="work-screen__icon"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>
      <span className="work-screen__eyebrow">PROJECT ENTITY / {label}</span>
      <h1>WORK IN PROGRESS</h1>
      <button type="button" data-sound="cancellation" onClick={onBack}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> &nbsp; BACK TO HOME</button>
    </div>
  </main>;
}
