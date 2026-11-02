import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CardDefinition } from '../../cards/CardRegistry';
import { getSettings } from '../../desktop/storage';
import { isDeckInPool, isDeckPlayable, type SavedDeck } from '../../decks';
import { setCloseReason } from '../../desktop/lifecycle';
import { createDraftDuel, draftMatchResult, scoreDraftGame, type DraftScore } from '../../game/draftDuel';
import { PACKS } from '../../shop/packs';
import { playSound } from '../../audio';
import type { GameState } from '../../types';
import { CardPreview } from '../cards/CardPreview';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import ProfileAvatar from '../common/ProfileAvatar';
import DeckCreator from '../decks/DeckCreator';
import GameView from '../game/GameView';
import { QuitDuelDialog } from '../game/MatchModals';
import { WorkInProgress } from '../hub/Home';
import { PackArtwork, PackOpening } from '../shop/PackOpening';
import DraftDuelIntro from './DraftDuelIntro';
import DraftPackReveal from './DraftPackReveal';
import StandbyDeck from './StandbyDeck';
import DraftMatchResult from './DraftMatchResult';
import './Singleplayer.css';

type Stage = 'intro' | 'packs' | 'opening' | 'editing' | 'standby' | 'game' | 'result';
type Run = ReturnType<typeof createDraftDuel> & { stage: Stage; packIndex: number; score: DraftScore; games: number };

export default function Singleplayer({ onBack }: { onBack: () => void }) {
  const [run, setRun] = useState<Run | null>(null);
  const [towers, setTowers] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [inspected, setInspected] = useState<CardDefinition | null>(null);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const finishIntro = useCallback(() => {
    setRun(current => current?.stage === 'intro' ? { ...current, stage: 'packs' } : current);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [run?.stage, run?.packIndex, towers]);
  useEffect(() => {
    setCloseReason('draft', run && run.stage !== 'result' ? 'Your Draft Duel run and its cards will be lost.' : null);
    return () => setCloseReason('draft', null);
  }, [!!run, run?.stage]);

  const start = () => {
    try {
      setRun({ ...createDraftDuel(), stage: 'intro', packIndex: 0, score: [0, 0], games: 0 });
      setError('');
    } catch { setError('The draft packs could not be prepared. Please try again.'); }
  };
  const finishGame = (state: GameState) => {
    setRun(current => {
      if (!current || current.stage !== 'game' || !state.winner) return current;
      const score = scoreDraftGame(current.score, state.isDraw ? 'draw' : state.winner === state.players[0].name ? 'victory' : 'defeat');
      return { ...current, score, games: current.games + 1, stage: draftMatchResult(score) ? 'result' : 'standby' };
    });
  };
  const useDeck = (deck: SavedDeck) => {
    if (!run || !isDeckPlayable(deck) || !isDeckInPool(deck, run.pool)) return;
    setRun({ ...run, deck, stage: 'standby' });
  };
  const abandon = () => { setRun(null); setQuitting(false); setInspected(null); };
  const openNext = () => {
    if (!run) return;
    setInspected(null);
    if (run.packIndex === run.batches.length - 1) setRun({ ...run, stage: 'editing' });
    else {
      playSound('to-the-void');
      setRun({ ...run, packIndex: run.packIndex + 1 });
    }
  };

  if (towers) return <WorkInProgress feature="towers" onBack={() => setTowers(false)} />;
  if (run?.stage === 'intro') return <DraftDuelIntro onComplete={finishIntro} />;
  if (run?.stage === 'editing') return <DeckCreator onBack={() => setRun({ ...run, stage: 'standby' })}
    draft={{ deck: run.deck, pool: run.pool, onDone: useDeck }} />;
  if (run?.stage === 'game') return <div className="draft-game">
    <div className="draft-game-score" role="status">Draft Duel · Game {run.games + 1} <strong>You {run.score[0]} – {run.score[1]} AI</strong><span>First to 2 points</span></div>
    <GameView key={run.games} opponentMode="ai" initialDecks={[run.deck, run.opponentDeck]} onQuit={abandon} onComplete={finishGame}
      quitMessage="Quitting ends this Draft Duel run. Its cards and deck will be lost. This game will award no XP; rewards from completed games are kept." />
  </div>;

  if (run?.stage === 'result') return <DraftMatchResult score={run.score} games={run.games} username={getSettings().username} profileImage={getSettings().profileImage} onContinue={abandon} />;
  const batch = run?.batches[run.packIndex];
  return <main className="entity-page shop singleplayer">
    {run ? <div className="draft-reveal-exit"><BackToHubButton onClick={() => setQuitting(true)} /></div> : <header className="entity-topbar"><PageBrand section="SINGLEPLAYER" />
      <BackToHubButton onClick={onBack} />
    </header>}
    <div className={`shop-body${run?.stage === 'opening' ? ' shop-body--opening' : ''}${run?.stage === 'packs' ? ' shop-body--draft-reveal' : ''}${run?.stage === 'standby' ? ' shop-body--standby' : ''}`}>
      <div className={run?.stage === 'packs' ? 'sr-only' : 'entity-section-heading'}>
        <h1 className="entity-title" ref={heading} tabIndex={-1}>{!run ? 'SINGLEPLAYER' : run.stage === 'opening' ? batch!.pack.name : run.stage === 'standby' ? <>DUEL STANDBY <span className="draft-standby-game-heading">– Prepare for Game {run.games + 1}</span></> : 'DRAFT DUEL'}</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!run ? <div className="singleplayer-modes">
        <section className="entity-panel singleplayer-mode singleplayer-mode--draft">
          <h2>DRAFT DUEL</h2>
          <div className="mode-pack-stage" aria-hidden="true"><div className="mode-pack-orbit">
            {[0, 1].map(copy => <div className="mode-pack-line" key={copy}>
              {PACKS.filter(pack => pack.id !== 'master').map(pack => <div className="mode-pack-line__item" key={pack.id} style={{ '--pack-color': pack.color } as React.CSSProperties}><PackArtwork pack={pack} /></div>)}
            </div>)}
          </div></div>
          <button className="entity-primary" data-sound="select" onClick={start}>Start Draft Duel <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </section>
        <section className="entity-panel singleplayer-mode singleplayer-mode--towers">
          <h2>TOWERS</h2><div className="mode-tower-art" aria-hidden="true"><i className="fa-solid fa-chess-rook" /><i className="fa-solid fa-chess-rook" /><i className="fa-solid fa-chess-rook" /></div><p>Coming soon</p>
          <button className="entity-primary" data-sound="select" onClick={() => setTowers(true)}>View Towers <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </section>
      </div> : run.stage === 'packs' ? <DraftPackReveal packs={run.packs} onOpen={() => { playSound('to-the-void'); setRun({ ...run, stage: 'opening' }); }} /> : run.stage === 'opening' && batch ? <>
        <p className="shop-session-progress">PACK {run.packIndex + 1} / 10 · {batch.pack.name} {run.packIndex % 5 + 1} / 5</p>
        <React.Fragment key={run.packIndex}><PackOpening pack={batch.pack} cards={batch.cards} onInspect={setInspected} onContinue={openNext}
          previousPack={run.batches[run.packIndex - 1]?.pack}
          newBatch={run.packIndex > 0 && batch.pack.id !== run.batches[run.packIndex - 1].pack.id} /></React.Fragment>
      </> : run.stage === 'standby' ? <section className="draft-duel-standby">
        <StandbyDeck run={run} onEdit={() => setRun({ ...run, stage: 'editing' })} onInspect={setInspected} />
        <div className="draft-standby-match">
          <div className="draft-standby-scoreboard" role="status" aria-label={`${getSettings().username} ${run.score[0]}, AI ${run.score[1]}`}>
            <div><div className="draft-standby-portrait"><div className="draft-intro__portrait draft-standby-avatar"><ProfileAvatar image={getSettings().profileImage} /></div></div><span>{getSettings().username}</span><strong>{run.score[0]}</strong></div>
            <span className="draft-standby-scoreboard__divider" aria-hidden="true">–</span>
            <div><div className="draft-standby-portrait draft-standby-portrait--ai"><div className="draft-intro__portrait draft-standby-avatar draft-standby-avatar--ai"><i className="fa-solid fa-chess-knight" aria-hidden="true" /></div></div><span>AI</span><strong>{run.score[1]}</strong></div>
          </div>
          <button className="entity-primary" data-sound="select" disabled={!isDeckPlayable(run.deck) || !isDeckInPool(run.deck, run.pool)} onClick={() => setRun({ ...run, stage: 'game' })}>Begin game {run.games + 1} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </div>
      </section> : null}
    </div>
    {inspected && <CardPreview card={inspected} onClose={() => setInspected(null)} />}
    {quitting && <QuitDuelDialog title="Leave Draft Duel?" message="This run, its drafted cards, and its deck will be lost. XP and statistics from completed games are kept." onCancel={() => setQuitting(false)} onConfirm={abandon} />}
  </main>;
}


