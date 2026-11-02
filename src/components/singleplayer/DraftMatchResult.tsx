import React, { useEffect, useRef } from 'react';
import { playSound } from '../../audio';
import { draftMatchResult, type DraftScore } from '../../game/draftDuel';
import ProfileAvatar from '../common/ProfileAvatar';
import './DraftDuelIntro.css';
import './DraftMatchResult.css';

export default function DraftMatchResult({ score, games, username, profileImage, onContinue }: {
  score: DraftScore; games: number; username: string; profileImage: string | null; onContinue: () => void;
}) {
  const result = draftMatchResult(score);
  const title = result === 'victory' ? 'Match Victory' : result === 'defeat' ? 'Match Defeat' : 'Match Draw';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const timer = window.setTimeout(() => playSound(result === 'defeat' ? 'defeat' : result === 'victory' ? 'high-effect' : 'turn-change'), 0);
    return () => window.clearTimeout(timer);
  }, [result]);
  return <main className={`duel-result draft-match-result${result === 'defeat' ? ' duel-result--defeat' : result === 'draw' ? ' duel-result--draw' : ''}`} aria-labelledby="draft-match-title">
    <div className="duel-result-vfx" aria-hidden="true"><div className="duel-result-ring" /><div className="duel-result-sweep" />{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
    <div className="draft-match-result__content">
      <header className="duel-result-heading"><h1 id="draft-match-title" ref={heading} tabIndex={-1}>{title}</h1><p>Draft Duel · {games} games</p></header>
      <div className="draft-match-result__arena">
        {[0, 1].map(index => <React.Fragment key={index}>
          {index === 1 && <div className="draft-match-result__score" aria-label={`Final score ${score[0]} to ${score[1]}`}><div><strong>{score[0]}</strong><span>–</span><strong>{score[1]}</strong></div><span className="draft-match-result__score-rule" /></div>}
          <section className={`draft-match-result__player${(result === 'victory' && index === 0) || (result === 'defeat' && index === 1) ? ' is-winner' : ''}`} aria-label={index === 0 ? username : 'AI'}>
            <div className={`draft-intro__portrait draft-match-result__portrait${index === 1 ? ' draft-match-result__portrait--ai' : ''}`}>{index === 0 ? <ProfileAvatar image={profileImage} /> : <i className="fa-solid fa-chess-knight" aria-hidden="true" />}</div>
            <h2>{index === 0 ? username : 'AI'}</h2>
            <div className="draft-match-result__points" aria-hidden="true">{[0, 1].map(point => <span key={point} className={score[index] > point ? 'is-earned' : ''} />)}</div>
          </section>
        </React.Fragment>)}
      </div>
      <button className="duel-result-button" data-sound="select" onClick={onContinue}>Continue</button>
    </div>
  </main>;
}
