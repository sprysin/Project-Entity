import { useEffect, useRef } from 'react';
import { getAccount, getSettings } from '../../desktop/storage';
import { accountProgress } from '../../game/duelReport';
import ProfileAvatar from '../common/ProfileAvatar';
import './DraftDuelIntro.css';

export default function DraftDuelIntro({ onComplete }: { onComplete: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { username, profileImage } = getSettings();
  const { level } = accountProgress(getAccount().totalXp);

  useEffect(() => {
    heading.current?.focus();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onComplete, reducedMotion ? 1600 : 4200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return <main className="entity-page draft-intro" aria-labelledby="draft-intro-title">
    <div className="draft-intro__field draft-intro__field--player" aria-hidden="true" />
    <div className="draft-intro__field draft-intro__field--ai" aria-hidden="true" />
    <h1 id="draft-intro-title" className="draft-intro__title" ref={heading} tabIndex={-1}>DRAFT DUEL</h1>
    <div className="draft-intro__matchup">
      <section className="draft-intro__contender draft-intro__contender--player" aria-label="Your profile">
        <div className="draft-intro__portrait"><ProfileAvatar image={profileImage} /></div>
        <h2>{username}</h2>
        <p>LEVEL {level.toLocaleString()}</p>
      </section>
      <div className="draft-intro__versus" aria-label="versus"><span aria-hidden="true">VS</span></div>
      <section className="draft-intro__contender draft-intro__contender--ai" aria-label="Opponent">
        <div className="draft-intro__portrait"><i className="fa-solid fa-chess-knight" aria-hidden="true" /></div>
        <h2>AI</h2>
      </section>
    </div>
  </main>;
}
