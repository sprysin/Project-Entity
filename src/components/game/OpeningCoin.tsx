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
        className={`opening-coin ${!flipping && aiChoosing && coin.aiOrder ? 'opening-coin--ai-choosing' : ''} ${coin.aiOrder === 'second' ? 'opening-coin--ai-second' : ''}`}
        ariaLabel="Opening coin flip"
        title={flipping ? 'OPENING FLIP' : <><span className="opening-coin__winner">{winner.name}</span> wins the flip</>}
        peeking={false}
        setPeeking={() => { }}
        actions={flipping ? [] : [
            { label: 'Go first', variant: 'primary', disabled: aiChoosing, onClick: () => onChoose('first') },
            { label: 'Go second', variant: 'secondary', disabled: aiChoosing, onClick: () => onChoose('second') },
        ]}
    >
        <div className="opening-coin__stage" aria-hidden="true">
            <div className="opening-coin__orbit" />
            <div className={`opening-coin__lift ${flipping ? 'is-flipping' : ''}`}>
                <div className={`opening-coin__token ${flipping ? 'is-flipping' : ''}`} style={{ '--coin-landing': `${coin.winnerIndex === 0 ? 2340 : 2160}deg` } as React.CSSProperties}>
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
                <span className={`opening-coin__swatch opening-coin__swatch--${index === 0 ? 'white' : 'black'}`} />
                <span>{player.name}<small>{index === 0 ? 'White' : 'Black'} side</small></span>
            </span>)}
        </div>
    </DuelPrompt>;
};
