import React from 'react';
import { GameState, OpponentMode } from '../../types';
import { DuelPrompt } from './DuelPrompt';

export const OpeningCoin: React.FC<{
    gameState: GameState;
    opponentMode: OpponentMode;
    onChoose: (order: 'first' | 'second') => void;
}> = ({ gameState, opponentMode, onChoose }) => {
    const coin = gameState.openingCoin;
    if (!coin) return null;
    const flipping = coin.stage === 'flipping';
    const aiChoosing = opponentMode === 'ai' && coin.winnerIndex === 1;
    const winner = gameState.players[coin.winnerIndex];
    return <DuelPrompt
        className="opening-coin"
        ariaLabel="Opening coin flip"
        title={flipping ? 'Fate is in the air' : `${winner.name} wins the flip`}
        peeking={false}
        setPeeking={() => { }}
        actions={flipping || aiChoosing ? [] : [
            { label: 'Go first', variant: 'primary', onClick: () => onChoose('first') },
            { label: 'Go second', variant: 'secondary', onClick: () => onChoose('second') },
        ]}
    >
        <div className="opening-coin__stage" aria-hidden="true">
            <div className="opening-coin__orbit" />
            <div className={`opening-coin__lift ${flipping ? 'is-flipping' : ''}`}>
                <div className={`opening-coin__token ${flipping ? 'is-flipping' : ''}`} style={{ '--coin-landing': `${coin.winnerIndex === 0 ? 2160 : 2340}deg` } as React.CSSProperties}>
                    {[0, 1].map(index => <div key={index} className={`opening-coin__face opening-coin__face--${index === 0 ? 'black' : 'white'}`}>
                        <i className="fa-solid fa-chess-pawn" />
                        <span className="opening-coin__seal">{index === 0 ? 'BLACK' : 'WHITE'}</span>
                    </div>)}
                </div>
            </div>
            <div className={`opening-coin__shadow ${flipping ? 'is-flipping' : ''}`} />
        </div>
        <div className="opening-coin__sides">
            {gameState.players.map((player, index) => <span key={player.id} className={`opening-coin__side ${!flipping && index === coin.winnerIndex ? 'is-winner' : ''}`}>
                <span className={`opening-coin__swatch opening-coin__swatch--${index === 0 ? 'black' : 'white'}`} />
                <span>{player.name}<small>{index === 0 ? 'Black' : 'White'} side</small></span>
            </span>)}
        </div>
        <p className="opening-coin__status" role="status" aria-live="polite">
            <span><br /></span>
            {flipping ? 'The winning side chooses the turn order.' : aiChoosing ? 'AI is choosing the turn order…' : 'Choose your opening move.'}
        </p>
    </DuelPrompt>;
};
