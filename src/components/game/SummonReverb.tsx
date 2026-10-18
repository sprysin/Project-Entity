import React, { useLayoutEffect, useRef, useState } from 'react';
import { Attribute, GameState, PawnSubtype, Position } from '../../types';
import { attributeColors } from '../cards/attributeColors';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';
import { VASSAL_IMPACT_MS } from '../../hooks/useCardMotion';

export type SummonReverbTrigger = { playerIndex: number; slot: number; color: string; instanceId: string; ritual: boolean };
type SummonReverbEvent = SummonReverbTrigger & { id: number };

/** New visible field arrivals are summons; sets, flips, and zone moves keep their identity. */
export function detectSummonReverbs(previous: GameState, next: GameState): SummonReverbTrigger[] {
  const previousFieldIds = new Set(previous.players.flatMap(player => player.pawnZones.flatMap(zone => zone ? [zone.card.instanceId] : [])));
  return next.players.flatMap((player, playerIndex) => player.pawnZones.flatMap((zone, slot) => {
    if (!zone || zone.position === Position.HIDDEN || previousFieldIds.has(zone.card.instanceId)) return [];
    const ritual = zone.card.pawnSubtype === PawnSubtype.VASSAL && previous.players.some(owner => owner.reserve.some(card => card.instanceId === zone.card.instanceId));
    if (!ritual && zone.card.level < 8) return [];
    return [{ playerIndex, slot, color: attributeColors[zone.card.attribute ?? Attribute.NORMAL], instanceId: zone.card.instanceId, ritual }];
  }));
}

export function useSummonReverb(gameState: GameState | null) {
  const previous = useRef<GameState | null>(null);
  const serial = useRef(0);
  const [reverbs, setReverbs] = useState<SummonReverbEvent[]>([]);
  const schedule = useManagedTimeout();

  useLayoutEffect(() => {
    if (!gameState) { previous.current = null; return; }
    const triggers = previous.current ? detectSummonReverbs(previous.current, gameState) : [];
    previous.current = gameState;
    if (!triggers.length) return;
    const additions = triggers.map(trigger => ({ ...trigger, id: ++serial.current }));
    setReverbs(current => [...current, ...additions]);
    additions.forEach(event => schedule(() => setReverbs(current => current.filter(item => item.id !== event.id)), event.ritual ? 1500 : 1100));
  }, [gameState, schedule]);

  return reverbs;
}

export function SummonReverb({ reverbs }: { reverbs: SummonReverbEvent[] }) {
  return <>{reverbs.filter(event => !event.ritual).map(event => <div
    key={event.id}
    className="summon-reverb"
    style={{ '--reverb-color': event.color, '--reverb-origin': `${64 + event.slot * 152}px` } as React.CSSProperties}
    aria-hidden="true"
  >
    <span className="summon-reverb__ring summon-reverb__ring--one" />
    <span className="summon-reverb__ring summon-reverb__ring--two" />
    <span className="summon-reverb__ring summon-reverb__ring--three" />
    <span className="summon-reverb__zones">{Array.from({ length: 5 }, (_, index) => <span key={index} style={{ '--wave-delay': `${Math.abs(index - event.slot) * 65}ms` } as React.CSSProperties} />)}</span>
  </div>)}</>;
}

/** Slot-local geometry sits behind the card face, leaving its artwork and stats clear. */
export function VassalRitual({ event }: { event?: SummonReverbEvent }) {
  if (!event) return null;
  return <div key={event.id} className="vassal-ritual" aria-hidden="true"
    style={{ '--ritual-color': event.color, '--ritual-impact': `${VASSAL_IMPACT_MS}ms` } as React.CSSProperties}>
    <svg className="vassal-ritual__circle" viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1.2">
      <g className="vassal-ritual__inscription">
        <circle className="vassal-ritual__draw" cx="80" cy="80" r="73" pathLength="1" />
        <circle cx="80" cy="80" r="64" strokeDasharray="1 5" strokeWidth="3" />
        <circle cx="80" cy="80" r="55" />
        <path d="M80 25 128 108H32ZM80 135 32 52H128Z" />
        <path d="M80 4V17M80 143V156M4 80H17M143 80H156M26 26 35 35M125 125 134 134M26 134 35 125M125 35 134 26" strokeWidth="2" />
      </g>
      <circle className="vassal-ritual__shockwave" cx="80" cy="80" r="65" strokeWidth="3" />
    </svg>
  </div>;
}
