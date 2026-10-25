import { useEffect, useState } from 'react';
import type { GameState } from '../../types';
import { accountProgress, getDuelReport } from '../../game/duelReport';
import { awardDuelXp, getAccount } from '../../desktop/storage';
import AccountProgress from '../account/AccountProgress';
import { WinnerModal } from './MatchModals';
import './DuelReport.css';

type Report = ReturnType<typeof getDuelReport>;

/** Presentation only: style-guide previews never write account progress. */
export function DuelReport({ report, beforeXp }: {
  report: Report; beforeXp: number;
}) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const [earned, setEarned] = useState(reducedMotion ? report.xp : 0);
  const rows = report.rows.filter(row => row.count > 0 && row.score > 0);
  useEffect(() => {
    if (reducedMotion) { setEarned(report.xp); return; }
    // The report arrives as one group; only the reward progresses after its entrance.
    const started = Date.now() + 850;
    const timer = setInterval(() => {
      const fraction = Math.max(0, Math.min(1, (Date.now() - started) / 1100));
      setEarned(Math.floor(report.xp * fraction));
      if (fraction >= 1) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [reducedMotion, report.xp]);

  const before = accountProgress(beforeXp);
  const progress = accountProgress(beforeXp + earned);
  const levelsGained = progress.level - before.level;

  return <section className="duel-report" aria-labelledby="duel-report-title">
    <header className="duel-report__header"><h3 id="duel-report-title">Performance</h3></header>
    {rows.length > 0 ? <table className="duel-report__breakdown">
      <caption className="sr-only">Duel score breakdown</caption>
      <thead><tr><th scope="col">FEATS</th><th scope="col">TOTAL</th><th scope="col">SCORE</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className={row.id === 'victory' ? 'duel-report__victory' : undefined}>
        <th scope="row">{row.label}</th><td>{row.count.toLocaleString()}</td><td>+{row.score.toLocaleString()}</td>
      </tr>)}</tbody>
    </table> : <p className="duel-report__empty">No scoring actions this duel.</p>}
    <div className="duel-report__summary">
      <div><h4>Duel score</h4><strong>{report.total.toLocaleString()}</strong></div>
      <div><h4>Account XP earned</h4><strong>{report.xp > 0 ? '+' : ''}{report.xp.toLocaleString()} <span>XP</span></strong></div>
    </div>
    <div className="duel-report__progress">
      <AccountProgress totalXp={beforeXp + earned} />
      <p className="duel-report__level-up" role="status">{levelsGained > 0 && <><i className="fa-solid fa-angles-up" aria-hidden="true" /> Level up! <span>Level {before.level} → {progress.level}</span></>}</p>
    </div>
  </section>;
}

/** Award once when the duel ends, independently of the result presentation. */
export function CompletedDuel({ gameState, isDefeat, onQuit }: { gameState: GameState; isDefeat: boolean; onQuit: () => void }) {
  const [finished] = useState(gameState);
  const [receipt, setReceipt] = useState({ beforeXp: getAccount().totalXp, afterXp: getAccount().totalXp, xp: 0 });
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSaving(true);
    setError('');
    void awardDuelXp(finished).then(result => { if (active) setReceipt(result); })
      .catch(() => { if (active) setError('Account XP could not be saved. Retry to keep your progress.'); })
      .finally(() => { if (active) setSaving(false); });
    return () => { active = false; };
  }, [finished, attempt]);
  return <WinnerModal gameState={finished} isDefeat={isDefeat} onQuit={onQuit}
    saving={saving} error={error} onRetry={() => setAttempt(value => value + 1)}>
    <DuelReport report={getDuelReport(finished, 0)} beforeXp={receipt.beforeXp} />
  </WinnerModal>;
}
