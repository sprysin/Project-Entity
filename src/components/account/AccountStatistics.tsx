import type { AccountStatistics as Statistics } from '../../desktop/storage';

export default function AccountStatistics({ statistics }: { statistics: Statistics }) {
  const duels = statistics.wins + statistics.losses + statistics.draws;
  const outcomes = [
    { label: 'Wins', value: statistics.wins, tone: 'wins' },
    { label: 'Losses', value: statistics.losses, tone: 'losses' },
    { label: 'Draws', value: statistics.draws, tone: 'draws' },
  ];
  const groups = [
    { title: 'Destruction', icon: 'crosshairs', rows: [
      ['Pawns destroyed by battle', statistics.battleDestructions.toLocaleString()],
      ['Pawns destroyed by effects', statistics.effectDestructions.toLocaleString()],
      ['Actions / Conditions destroyed', statistics.actionDestructions.toLocaleString()],
    ] },
    { title: 'Summoning', icon: 'layer-group', rows: [
      ['Tribute summons', statistics.tributeSummons.toLocaleString()],
      ['Vassal summons', statistics.vassalSummons.toLocaleString()],
      ['Merge summons', statistics.mergeSummons.toLocaleString()],
    ] },
  ];

  return <section className="account-statistics" aria-labelledby="account-statistics-title">
    <header className="account-statistics__heading">
      <h2 id="account-statistics-title">Duel statistics</h2>
    </header>
    <section className="account-record" aria-labelledby="account-record-title">
      <header className="account-record__heading">
        <h3 id="account-record-title">Duel record</h3>
        <p><strong>{duels.toLocaleString()}</strong> Games Played</p>
      </header>
      <div className="account-record__body">
        <dl className="account-record__rate"><div>
          <dt>Win rate</dt>
          <dd>{duels ? <>{(statistics.wins / duels * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}<span>%</span></> : '—'}</dd>
        </div></dl>
        <dl className="account-record__outcomes">
          {outcomes.map(outcome => <div className={`account-record__${outcome.tone}`} key={outcome.label}>
            <dt>{outcome.label}</dt><dd>{outcome.value.toLocaleString()}</dd>
          </div>)}
        </dl>
      </div>
      <div className="account-record__distribution" aria-hidden="true">
        {outcomes.map(outcome => <span className={`account-record__${outcome.tone}`} key={outcome.label} style={{ flexGrow: duels ? outcome.value / duels : 0 }} />)}
      </div>
      {!duels && <p className="account-record__empty">Complete your first duel to begin your record.</p>}
    </section>
    <section className="account-bests" aria-labelledby="account-bests-title">
      <h3 id="account-bests-title"><i className="fa-solid fa-trophy" aria-hidden="true" />Personal bests</h3>
      <dl>
        <div><dt>Highest duel score</dt><dd>{statistics.highestDuelScore.toLocaleString()}</dd></div>
        <div><dt>Most damage dealt in one duel</dt><dd>{statistics.mostDamageInDuel.toLocaleString()}</dd></div>
      </dl>
    </section>
    <div className="account-statistics__groups">
      {groups.map(group => <section className="account-statistics__group" key={group.title} aria-label={group.title}>
        <h3><i className={`fa-solid fa-${group.icon}`} aria-hidden="true" />{group.title}</h3>
        <dl>{group.rows.map(([label, value]) => <div key={label} data-empty={value === '0'}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>)}
    </div>
  </section>;
}
