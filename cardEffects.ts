import { GameState, Card, CardType, Position, EffectResult } from './types';

/**
 * Validates if a card's effect conditions are met before activation.
 */
export const checkActivationConditions = (state: GameState, card: Card, playerIndex: number): boolean => {
  const otherPlayerIndex = (playerIndex + 1) % 2;

  switch (card.id) {
    case 'action_02': // Quick recovery: Needs Opponent Entity AND Lv3 or lower Entity in Discard
      const oppHasEntity = state.players[otherPlayerIndex].entityZones.some(z => z !== null);
      const hasLowLevelInDiscard = state.players[playerIndex].discard.some(c => c.type === CardType.ENTITY && c.level <= 3);
      return oppHasEntity && hasLowLevelInDiscard;

    case 'entity_04': // Void Caster: Needs "Void Blast" in Discard
      return state.players[playerIndex].discard.some(c => c.id === 'action_01');

    case 'entity_02': // High King: Needs a face-up monster target
      return state.players.some(p => p.entityZones.some(z => z !== null && z.position !== Position.HIDDEN));

    case 'entity_05': // Charged Dragon: Needs at least 1 card in hand to discard
      return state.players[playerIndex].hand.length > 0;

    case 'condition_01': // Reinforcement: Needs a face-up entity target
      return state.players.some(p => p.entityZones.some(z => z !== null && z.position !== Position.HIDDEN));

    case 'condition_02': // Void Call: Needs a set Action/Condition target
      return state.players.some(p => p.actionZones.some(z => z !== null && z.position === Position.HIDDEN));

    default:
      return true;
  }
};

/**
 * applyCardEffect
 * Master switch for all unique card abilities.
 * Returns the updated game state and a log message, or a target/selection requirement.
 */
export const applyCardEffect = (
  state: GameState,
  card: Card,
  target?: { playerIndex: number, type: 'entity' | 'action', index: number },
  discardIndex?: number,
  handIndex?: number
): EffectResult => {
  const newState = JSON.parse(JSON.stringify(state));
  let log = "";

  switch (card.id) {
    case 'entity_01': // Solstice Sentinel - Passive LP gain on Normal Summon
      newState.players[state.activePlayerIndex].lp += 100;
      log = "SOLSTICE SENTINEL: +100 LP.";
      break;

    case 'entity_02': // High King - Targeted ATK reduction
      if (!target) {
        return {
          newState,
          log: "High King: Target an Entity.",
          requireTarget: 'entity'
        };
      }
      const tP = newState.players[target.playerIndex];
      const tE = tP.entityZones[target.index];
      if (tE && tE.position !== Position.HIDDEN) {
        const modifiedCard = { ...tE.card, atk: Math.max(0, tE.card.atk - 20) };
        const newEntityZones = [...tP.entityZones];
        newEntityZones[target.index] = { ...tE, card: modifiedCard };

        newState.players[target.playerIndex] = {
          ...tP,
          entityZones: newEntityZones
        };
        log = `High King: ${tE.card.name} loses 20 ATK.`;
      } else {
        return {
          newState,
          log: "High King: Invalid target.",
          requireTarget: 'entity'
        };
      }
      break;

    case 'entity_03': // Force Fire Sparker - Damage based on opponent's set cards
      const sparkerOppIdx = (state.activePlayerIndex + 1) % 2;
      const sparkerOpp = newState.players[sparkerOppIdx];
      const setCardCount = sparkerOpp.actionZones.filter(z => z && z.position === Position.HIDDEN).length;
      const damage = setCardCount * 10;

      if (damage > 0) {
        newState.players[sparkerOppIdx] = {
          ...sparkerOpp,
          lp: sparkerOpp.lp - damage
        };
        log = `FORCE FIRE SPARKER: ${damage} damage dealt (${setCardCount} set cards).`;
      } else {
        log = "FORCE FIRE SPARKER: No set cards found. 0 Damage.";
      }
      break;

    case 'entity_04': // Void Caster - Retrieve "Void Blast" from discard
      const vcPlayer = newState.players[state.activePlayerIndex];
      const vbIndex = vcPlayer.discard.findIndex(c => c.id === 'action_01');

      if (vbIndex !== -1) {
        const recoveredCard = vcPlayer.discard[vbIndex];
        const newDiscard = [...vcPlayer.discard];
        newDiscard.splice(vbIndex, 1);

        newState.players[state.activePlayerIndex] = {
          ...vcPlayer,
          hand: [...vcPlayer.hand, recoveredCard],
          discard: newDiscard
        };
        log = "VOID CASTER: Retrieved 'Void Blast' from Discard.";
      } else {
        log = "VOID CASTER: 'Void Blast' not found in Discard.";
      }
      break;

    case 'entity_05': // High Voltage - Charged Dragon: Discard 1 to gain 10 ATK
      if (handIndex === undefined) {
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
      const discardedCard = dragonPlayer.hand[handIndex];

      if (discardedCard) {
        // 1. Move card from Hand to Discard
        const newHand = [...dragonPlayer.hand];
        newHand.splice(handIndex, 1);
        const newDiscard = [...dragonPlayer.discard, discardedCard];

        // 2. Find the dragon on field and buff it
        const zoneIndex = dragonPlayer.entityZones.findIndex(z => z && z.card.instanceId === card.instanceId);
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
          log = `CHARGED DRAGON: Discarded ${discardedCard.name}. ATK increased to ${buffedDragon.atk} (Resets During End Phase).`;
        } else {
          // Edge case: Dragon left field while effect was pending? 
          // Still pay cost but no buff.
          newState.players[state.activePlayerIndex] = {
            ...dragonPlayer,
            hand: newHand,
            discard: newDiscard
          };
          log = "CHARGED DRAGON: Discarded for cost, but Entity not found on field.";
        }
      }
      break;

    case 'action_01': // Void Blast - Simple direct LP damage
      const oppIdx = (state.activePlayerIndex + 1) % 2;
      newState.players[oppIdx].lp -= 50;
      log = "VOID BLAST: 50 damage dealt.";
      break;

    case 'action_02': // Quick recovery - Recycle low level entity + Heal
      const qrOppIdx = (state.activePlayerIndex + 1) % 2;
      const qrOpp = newState.players[qrOppIdx];
      const hasEntity = qrOpp.entityZones.some(z => z !== null);

      if (hasEntity) {
        const qrPlayer = newState.players[state.activePlayerIndex];

        // If we haven't selected a card yet, request selection
        if (discardIndex === undefined) {
          return {
            newState,
            log: "Select a card to recover.",
            requireDiscardSelection: {
              playerIndex: state.activePlayerIndex,
              filter: (c: Card) => c.type === CardType.ENTITY && c.level <= 3,
              title: "Select Level 3 or Lower Entity"
            }
          };
        }

        // Resolve with selected index
        const recoveredEntity = qrPlayer.discard[discardIndex];
        if (recoveredEntity && recoveredEntity.type === CardType.ENTITY && recoveredEntity.level <= 3) {
          const newDiscard = [...qrPlayer.discard];
          newDiscard.splice(discardIndex, 1);

          newState.players[state.activePlayerIndex] = {
            ...qrPlayer,
            hand: [...qrPlayer.hand, recoveredEntity],
            discard: newDiscard,
            lp: qrPlayer.lp + 20
          };
          log = `QUICK RECOVERY: Returned ${recoveredEntity.name} & +20 LP.`;
        } else {
          log = "QUICK RECOVERY: Invalid selection.";
        }
      } else {
        log = "QUICK RECOVERY: Opponent controls no Entities.";
      }
      break;

    case 'condition_01': // Reinforcement - Targeted buff to an entity
      if (!target) {
        return {
          newState,
          log: "REINFORCEMENT: Target an Entity.",
          requireTarget: 'entity'
        };
      }
      const reP = newState.players[target.playerIndex];
      const reE = reP.entityZones[target.index];
      if (reE && reE.position !== Position.HIDDEN) {
        const poweredCard = { ...reE.card, atk: reE.card.atk + 20 };
        const newZones = [...reP.entityZones];
        newZones[target.index] = { ...reE, card: poweredCard };

        newState.players[target.playerIndex] = {
          ...reP,
          entityZones: newZones
        };
        log = `REINFORCEMENT: ${reE.card.name} gains 20 ATK.`;
      } else {
        return {
          newState,
          log: "REINFORCEMENT: Invalid target.",
          requireTarget: 'entity'
        };
      }
      break;

    case 'condition_02': // Void Call - Banishes a set card from the opponent's field
      if (!target) {
        return {
          newState,
          log: "VOID CALL: Target a set Action/Condition.",
          requireTarget: 'action'
        };
      }
      const vcP = newState.players[target.playerIndex];
      const vcC = vcP.actionZones[target.index];
      if (vcC && vcC.position === Position.HIDDEN) {
        const newVoid = [...vcP.void, vcC.card];
        const newActions = [...vcP.actionZones];
        newActions[target.index] = null;
        newState.players[target.playerIndex] = {
          ...vcP,
          void: newVoid,
          actionZones: newActions
        };
        log = "VOID CALL: Card banished to Void.";
      } else {
        return {
          newState,
          log: "VOID CALL: Invalid target (Must be Set Action/Condition Card).",
          requireTarget: 'action'
        };
      }
      break;

    default:
      log = `${card.name}: Effect resolved.`;
      break;
  }

  return { newState, log };
};