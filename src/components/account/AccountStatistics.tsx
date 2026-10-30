import type { AccountStatistics as Statistics } from '../../desktop/storage';

export default function AccountStatistics({ statistics }: { statistics: Statistics }) {
  const duels = statistics.wins + statistics.losses + statistics.draws;
  const groups = [
    { title: 'Duel record', rows: [
      ['Completed duels', duels.toLocaleString()],
      ['Wins', statistics.wins.toLocaleString()],
      ['Losses', statistics.losses.toLocaleString()],
      ['Draws', statistics.draws.toLocaleString()],
      ['Win rate', duels ? `${(statistics.wins / duels * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : '—'],
    ] },
    { title: 'Destruction', rows: [
      ['Pawns destroyed by battle', statistics.battleDestructions.toLocaleString()],
      ['Pawns destroyed by effects', statistics.effectDestructions.toLocaleString()],
      ['Actions / Conditions destroyed', statistics.actionDestructions.toLocaleString()],
    ] },
    { title: 'Summoning', rows: [
      ['Tribute summons', statistics.tributeSummons.toLocaleString()],
      ['Vassal summons', statistics.vassalSummons.toLocaleString()],
      ['Merge summons', statistics.mergeSummons.toLocaleString()],
    ] },
    { title: 'Personal bests', rows: [
      ['Highest duel score', statistics.highestDuelScore.toLocaleString()],
      ['Most damage dealt in one duel', statistics.mostDamageInDuel.toLocaleString()],
    ] },
  ];

  return <section className="account-statistics" aria-labelledby="account-statistics-title">
    <header className="account-statistics__heading">
      <h2 id="account-statistics-title">Duel statistics</h2>
    </header>
    <div className="account-statistics__groups">
      {groups.map(group => <section className="account-statistics__group" key={group.title} aria-label={group.title}>
        <h3>{group.title}</h3>
        <dl>{group.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>)}
    </div>
  </section>;
}
