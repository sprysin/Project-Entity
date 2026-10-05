import React, { useEffect, useState } from 'react';
import { GameState } from '../../types';
import { FieldLink, LinkGraphic, fieldBounds, sameFieldLink } from './AttachmentOverlay';

type Attack = Extract<NonNullable<GameState['deferredAction']>, { kind: 'attack' }>;

/** Follows a declared attack until its delayed combat resolution completes. */
export function AttackOverlay({ attack, defendingPlayerId }: { attack?: Attack; defendingPlayerId: string }) {
    const [link, setLink] = useState<FieldLink | null>(null);
    useEffect(() => {
        if (!attack) { setLink(null); return; }
        let frame = 0;
        let source: HTMLElement | undefined;
        let target: HTMLElement | undefined;
        const update = () => {
            if (!source?.isConnected || source.dataset.fieldCardId !== attack.attackerId
                || !target?.isConnected || (attack.targetId === 'direct'
                    ? target.dataset.playerHandTarget !== defendingPlayerId : target.dataset.fieldCardId !== attack.targetId)) {
                const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-field-card-id]'));
                source = cards.find(element => element.dataset.fieldCardId === attack.attackerId);
                target = attack.targetId === 'direct'
                    ? Array.from(document.querySelectorAll<HTMLElement>('[data-player-hand-target]'))
                        .find(element => element.dataset.playerHandTarget === defendingPlayerId)
                    : cards.find(element => element.dataset.fieldCardId === attack.targetId);
            }
            if (!source?.isConnected || !target?.isConnected) { setLink(previous => previous === null ? previous : null); frame = requestAnimationFrame(update); return; }
            const next = { source: fieldBounds(source), target: fieldBounds(target) };
            setLink(previous => previous && sameFieldLink(previous, next) ? previous : next);
            frame = requestAnimationFrame(update);
        };
        update();
        return () => cancelAnimationFrame(frame);
    }, [attack?.attackerId, attack?.targetId, defendingPlayerId]);
    return link ? <LinkGraphic link={link} kind="attack" outlineTarget={attack?.targetId !== 'direct'} /> : null;
}
