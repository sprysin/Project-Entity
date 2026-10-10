import { fieldEntries, targetZone } from './field';
import { fieldStats } from './cardHelpers';
import { isToken } from './cardHelpers';
import { Card, CardContext, EffectTrigger, GameState, PlacedCard, Position } from '../types';

type LocatedCard = { playerIndex: number; zone: 'pawn' | 'action' | 'land'; placed: PlacedCard };

const quote = (value: string) => `"${value}"`;

const joinNames = (cards: Card[]) => cards.map(card => quote(card.name)).join(', ');

function fieldCards(state: GameState): Map<string, LocatedCard> {
    const cards = new Map<string, LocatedCard>();
    fieldEntries(state).forEach(({ zone, target }) => cards.set(zone.card.instanceId, { playerIndex: target.playerIndex, zone: target.type, placed: zone }));
    return cards;
}

function selectedCard(state: GameState, context: CardContext): Card | undefined {
    const player = state.players[context.playerIndex];
    if (context.handIndex !== undefined) return player.hand[context.handIndex];
    if (context.discardIndex !== undefined) return player.discard[context.discardIndex];
    if (context.deckIndex !== undefined) return player.deck[context.deckIndex];
    if (context.reserveIndex !== undefined) return player.reserve[context.reserveIndex];
}

/** Builds one successful effect log entry from state changes instead of card-authored prose. */
export function formatEffectLog(
    before: GameState,
    after: GameState,
    card: Card,
    context: CardContext,
    trigger: EffectTrigger,
    tributes: Card[] = []
): string {
    const details: string[] = [];
    const beforeField = fieldCards(before);
    const afterField = fieldCards(after);
    const destroyed = new Set((after.destroyedCardIds ?? []).slice(before.destroyedCardIds?.length ?? 0));
    const selectedTargets = context.targets ?? (context.target ? [context.target] : []);
    const targets = selectedTargets.flatMap(target => {
        const zone = targetZone(before, target);
        return zone ? [zone.card] : [];
    });

    if (targets.length) details.push(`targets ${joinNames(targets)}`);
    if (tributes.length) details.push(`tributes ${joinNames(tributes)}`);

    for (const insertion of (after.bombInsertions ?? []).slice(before.bombInsertions?.length ?? 0)) {
        const names = new Map<string, number>();
        for (const bomb of insertion.cards) names.set(bomb.name, (names.get(bomb.name) ?? 0) + 1);
        for (const [name, count] of names) {
            details.push(`shuffles ${count} ${quote(name)} ${count === 1 ? 'Bomb' : 'Bombs'} into ${quote(after.players[insertion.playerIndex].name)}'s deck`);
        }
    }

    const selected = selectedCard(before, context);
    if (selected && context.handIndex !== undefined && !after.players[context.playerIndex].hand.some(c => c.instanceId === selected.instanceId)) {
        details.push(`discards ${quote(selected.name)}`);
    }
    if (selected && context.deckIndex !== undefined && after.players[context.playerIndex].hand.some(c => c.instanceId === selected.instanceId)) {
        details.push(`adds ${quote(selected.name)} to hand`);
    }

    before.players.forEach((player, playerIndex) => {
        const handIds = new Set(after.players[playerIndex].hand.map(c => c.instanceId));
        const drawn = player.deck.filter(c => c.instanceId !== selected?.instanceId || context.deckIndex === undefined)
            .filter(c => handIds.has(c.instanceId)).length;
        if (drawn) details.push(`${quote(player.name)} draws ${drawn} ${drawn === 1 ? 'card' : 'cards'}`);
    });

    const previousPeeks = new Set((before.peekEvents ?? []).map(event => event.id));
    (after.peekEvents ?? []).filter(event => !previousPeeks.has(event.id)).forEach(event => {
        details.push(`reveals ${quote(event.card.name)} from ${quote(before.players[event.ownerPlayerIndex].name)}'s hand`);
    });

    before.players.forEach((player, playerIndex) => {
        const delta = after.players[playerIndex].lp - player.lp;
        if (delta) details.push(`${quote(player.name)} ${delta > 0 ? '+' : ''}${delta} LP`);
    });

    for (const [instanceId, located] of beforeField) {
        const changed = afterField.get(instanceId);
        if (!changed) {
            const wasBanished = after.players.some(player => player.void.some(c => c.instanceId === instanceId));
            if (destroyed.has(instanceId)) details.push(`destroys ${quote(located.placed.card.name)}`);
            else if (isToken(located.placed.card)) details.push(`removes ${quote(located.placed.card.name)} from the game`);
            else if (wasBanished) details.push(`sends ${quote(located.placed.card.name)} to the Void`);
            else if (!tributes.some(tribute => tribute.instanceId === instanceId) && after.players.some(player => player.discard.some(c => c.instanceId === instanceId))) details.push(`sends ${quote(located.placed.card.name)} to the Discard`);
            continue;
        }
        const atkDelta = fieldStats(after, changed.placed).atk - fieldStats(before, located.placed).atk;
        for (const name of new Set([...Object.keys(located.placed.counters ?? {}), ...Object.keys(changed.placed.counters ?? {})])) {
            const delta = (changed.placed.counters?.[name] ?? 0) - (located.placed.counters?.[name] ?? 0);
            if (delta) details.push(`${quote(changed.placed.card.name)} ${delta > 0 ? '+' : ''}${delta} ${name}`);
        }
        const defDelta = changed.placed.card.def - located.placed.card.def;
        if (atkDelta) details.push(`${quote(changed.placed.card.name)} ${atkDelta > 0 ? '+' : ''}${atkDelta} ATK`);
        if (defDelta) details.push(`${quote(changed.placed.card.name)} ${defDelta > 0 ? '+' : ''}${defDelta} DEF`);
        if (changed.placed.card.attribute !== located.placed.card.attribute && changed.placed.position !== Position.HIDDEN) {
            details.push(`${quote(changed.placed.card.name)} becomes ${changed.placed.card.attribute}`);
        }
        if (changed.placed.position !== located.placed.position) details.push(
            changed.zone === 'action' && changed.placed.position === Position.FACE_UP
                ? `${quote(changed.placed.card.name)} turns face-up`
                : `${quote(changed.placed.card.name)} to ${changed.placed.position}`
        );
    }

    for (const [instanceId, located] of afterField) {
        if (beforeField.has(instanceId) || instanceId === card.instanceId) continue;
        if (located.zone === 'land') { details.push(`${quote(located.placed.card.name)} becomes the active Land`); continue; }
        details.push(`${before.players[located.playerIndex].reserve.some(value => value.instanceId === instanceId) ? 'Vassal summons' : 'special summons'} ${quote(located.placed.card.name)}`);
    }

    if (selected && context.discardIndex !== undefined && after.players[context.playerIndex].hand.some(c => c.instanceId === selected.instanceId)) {
        details.push(`returns ${quote(selected.name)} to hand`);
    }

    const verb = card.type === 'PAWN' || trigger === 'summon' || trigger === 'phase' ? 'effect activated' : 'activated';
    return `${quote(card.name)} ${verb}${details.length ? `, ${details.join('; ')}` : ''}.`;
}

/** Builds the field-entry log independently from any on-summon effect. */
export function formatSummonLog(card: Card): string {
    return `${quote(card.name)} ${card.level >= 5 ? 'tribute summoned' : 'summoned'}.`;
}
