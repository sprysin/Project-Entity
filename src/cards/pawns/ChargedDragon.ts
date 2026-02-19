import { IEffect, GameState, CardContext, EffectResult } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));

        if (context.handIndex === undefined) {
            return {
                newState,
                log: "Select a card to discard.",
                requireHandSelection: {
                    playerIndex: state.activePlayerIndex,
                    title: "Discard Cost: Select 1 Card"
                }
            };
        }

        const dragonPlayer = newState.players[state.activePlayerIndex];
        const discardedCard = dragonPlayer.hand[context.handIndex];

        if (discardedCard) {
            // 1. Move card from Hand to Discard
            const newHand = [...dragonPlayer.hand];
            newHand.splice(context.handIndex, 1);
            const newDiscard = [...dragonPlayer.discard, discardedCard];

            // 2. Find the dragon on field and buff it
            // Note: context.card is the card in hand/field that triggered this. 
            // If onField activation, we need to find it by instanceId
            const zoneIndex = dragonPlayer.entityZones.findIndex((z: any) => z && z.card.instanceId === context.card.instanceId);
            const newEntityZones = [...dragonPlayer.entityZones];

            if (zoneIndex !== -1) {
                const dragonZone = newEntityZones[zoneIndex]!;
                const buffedDragon = { ...dragonZone.card, atk: dragonZone.card.atk + 10 };
                newEntityZones[zoneIndex] = { ...dragonZone, card: buffedDragon };

                // Add pending effect to reset ATK at End Phase
                newState.pendingEffects = [
                    ...(newState.pendingEffects || []),
                    {
                        type: 'RESET_ATK',
                        targetInstanceId: dragonZone.card.instanceId,
                        value: 250,
                        dueTurn: state.turnNumber
                    }
                ];

                newState.players[state.activePlayerIndex] = {
                    ...dragonPlayer,
                    hand: newHand,
                    discard: newDiscard,
                    entityZones: newEntityZones
                };
                return {
                    newState,
                    log: `CHARGED DRAGON: Discarded ${discardedCard.name}. ATK increased to ${buffedDragon.atk} (Resets During End Phase).`
                };
            } else {
                // Edge case: Dragon left field while effect was pending
                newState.players[state.activePlayerIndex] = {
                    ...dragonPlayer,
                    hand: newHand,
                    discard: newDiscard
                };
                return {
                    newState,
                    log: "CHARGED DRAGON: Discarded for cost, but Entity not found on field."
                };
            }
        }
        return { newState, log: "Error: No card selected." };
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        return state.players[context.playerIndex].hand.length > 0;
    }
};

cardRegistry.register('entity_05', effect);
