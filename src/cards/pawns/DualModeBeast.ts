import { IEffect, GameState, CardContext, EffectResult, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));

        if (context.handIndex === undefined) {
            return {
                newState,
                log: "DUAL-MODE BEAST: Select a card to discard.",
                requireHandSelection: {
                    playerIndex: state.activePlayerIndex,
                    title: "Discard Cost: Select 1 Card"
                }
            };
        }

        if (!context.target) {
            return {
                newState,
                log: "DUAL-MODE BEAST: Target 1 attack position monster on your opponent's field.",
                requireTarget: 'entity'
            };
        }

        if (context.target.playerIndex === state.activePlayerIndex) {
            return {
                newState,
                log: "DUAL-MODE BEAST: Must target an opponent's monster."
            };
        }

        const oppPlayer = newState.players[context.target.playerIndex];
        const targetEntity = oppPlayer.entityZones[context.target.index];

        if (!targetEntity || targetEntity.position !== Position.ATTACK) {
            return {
                newState,
                log: "DUAL-MODE BEAST: Target must be in Attack position."
            };
        }

        const activePlayer = newState.players[state.activePlayerIndex];
        const discardedCard = activePlayer.hand[context.handIndex];

        if (discardedCard) {
            activePlayer.hand.splice(context.handIndex, 1);
            activePlayer.discard.push(discardedCard);

            targetEntity.position = Position.DEFENSE;

            return {
                newState,
                log: `DUAL-MODE BEAST: Discarded ${discardedCard.name}. Changed ${targetEntity.card.name} to Defense position.`
            };
        }

        return {
            newState,
            log: "Error: Could not discard card."
        };
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        const activePlayer = state.players[context.playerIndex];
        const oppPlayer = state.players[(context.playerIndex + 1) % 2];
        const hasHand = activePlayer.hand.length > 0;
        const hasValidTarget = oppPlayer.entityZones.some(z => z !== null && z.position === Position.ATTACK);
        return hasHand && hasValidTarget;
    }
};

cardRegistry.register('entity_06', effect);
