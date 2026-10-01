import React, { useEffect, useRef, useState } from 'react';
import { Attribute, GameState, Position } from '../../types';
import { attributeColors } from '../cards/attributeColors';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';

export type SummonReverbTrigger = { playerIndex: number; slot: number; color: string; instanceId: string };
type SummonReverbEvent = SummonReverbTrigger & { id: number };

/** New visible field arrivals are summons; sets, flips, and zone moves keep their identity. */
export function detectSummonReverbs(previous: GameState, next: GameState): SummonReverbTrigger[] {
  const previousFieldIds = new Set(previous.players.flatMap(player => player.pawnZones.flatMap(zone => zone ? [zone.card.instanceId] : [])));
  return next.players.flatMap((player, playerIndex) => player.pawnZones.flatMap((zone, slot) => {
    if (!zone || zone.position === Position.HIDDEN || zone.card.level < 8 || previousFieldIds.has(zone.card.instanceId)) return [];
    return [{ playerIndex, slot, color: attributeColors[zone.card.attribute ?? Attribute.NORMAL], instanceId: zone.card.instanceId }];
  }));
}

export function useSummonReverb(gameState: GameState | null) {
  const previous = useRef<GameState | null>(null);
  const serial = useRef(0);
  const [reverbs, setReverbs] = useState<SummonReverbEvent[]>([]);
  const schedule = useManagedTimeout();

  useEffect(() => {
    if (!gameState) { previous.current = null; return; }
    const triggers = previous.current ? detectSummonReverbs(previous.current, gameState) : [];
    previous.current = gameState;
    if (!triggers.length) return;
    const additions = triggers.map(trigger => ({ ...trigger, id: ++serial.current }));
    setReverbs(current => [...current, ...additions]);
    additions.forEach(event => schedule(() => setReverbs(current => current.filter(item => item.id !== event.id)), 1100));
  }, [gameState, schedule]);

  return reverbs;
}

export function SummonReverb({ reverbs }: { reverbs: SummonReverbEvent[] }) {
  return <>{reverbs.map(event => <div
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
