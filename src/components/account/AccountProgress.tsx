import { accountProgress } from '../../game/duelReport';
import './AccountProgress.css';

export default function AccountProgress({ totalXp }: { totalXp: number }) {
  const progress = accountProgress(totalXp);
  return <div className="account-progress">
    <div className="account-progress__heading"><strong>LEVEL {progress.level.toLocaleString()}</strong><span>{progress.xp.toLocaleString()} / {progress.required.toLocaleString()} XP</span></div>
    <progress value={progress.xp} max={progress.required} aria-label={`Account level ${progress.level} progress`} />
    <p>{(progress.required - progress.xp).toLocaleString()} XP to Level {(progress.level + 1).toLocaleString()}</p>
  </div>;
}
