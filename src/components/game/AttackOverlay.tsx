import React, { useEffect, useState } from 'react';
import { GameState } from '../../types';
import { FieldLink, LinkGraphic } from './AttachmentOverlay';

type Attack = Extract<NonNullable<GameState['deferredAction']>, { kind: 'attack' }>;

/** Follows a declared attack until its delayed combat resolution completes. */
export function AttackOverlay({ attack, defendingPlayerId }: { attack?: Attack; defendingPlayerId: string }) {
    const [link, setLink] = useState<FieldLink | null>(null);
    useEffect(() => {
        if (!attack) { setLink(null); return; }
        let frame = 0;
        const update = () => {
            const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-field-card-id]'));
            const source = cards.find(element => element.dataset.fieldCardId === attack.attackerId);
            const target = attack.targetId === 'direct'
                ? Array.from(document.querySelectorAll<HTMLElement>('[data-player-hand-target]'))
                    .find(element => element.dataset.playerHandTarget === defendingPlayerId)
                : cards.find(element => element.dataset.fieldCardId === attack.targetId);
            if (!source?.isConnected || !target?.isConnected) { setLink(null); frame = requestAnimationFrame(update); return; }
            const bounds = (element: HTMLElement) => {
                const rect = element.getBoundingClientRect();
                return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            };
            const next = { source: bounds(source), target: bounds(target) };
            setLink(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
            frame = requestAnimationFrame(update);
        };
        update();
        return () => cancelAnimationFrame(frame);
    }, [attack?.attackerId, attack?.targetId, defendingPlayerId]);
    return link ? <LinkGraphic link={link} kind="attack" outlineTarget={attack?.targetId !== 'direct'} /> : null;
}
