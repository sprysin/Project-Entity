import React from 'react';
import { Player } from '../../types';

type LpFlash = 'damage' | 'heal' | null;

interface HealthHudProps {
    player: Player;
    displayedLp: number;
    flash: LpFlash;
    position: 'active' | 'opponent';
}

export const HealthHud: React.FC<HealthHudProps> = ({ player, displayedLp, flash, position }) => {
    const isActive = position === 'active';
    const frameGradientId = `health-frame-${player.id}-${position}`;
    const framePath = isActive ? 'M 0 0 H 72 L 100 100 H 0 Z' : 'M 0 0 H 100 V 100 H 28 Z';
    const insetPath = isActive ? 'M 2 5 H 70.6 L 95.8 95 H 2 Z' : 'M 4.2 5 H 98 V 95 H 29.4 Z';

    return (
        <section
            aria-label={`${isActive ? 'Active player' : 'Opponent'} life points`}
            className={`health-hud health-hud--${position}`}
            data-player-id={player.id}
        >
            <div className="health-hud__identity">
                <span className="health-hud__emblem" aria-hidden="true"><span /></span>
                <span className="health-hud__name">{player.name}</span>
            </div>
            <div className="health-hud__rule" />
            <div className="health-hud__frame">
                <div className="health-hud__plate">
                    <span className="health-hud__lp-label">LP</span>
                    <span className={`health-hud__lp-value ${flash ? `health-hud__lp-value--${flash} lp-active` : ''}`}>
                        {Math.floor(displayedLp)}
                    </span>
                </div>
                <svg className="health-hud__outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id={frameGradientId} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#ffffff" />
                            <stop offset="0.38" stopColor="#737373" />
                            <stop offset="0.62" stopColor="#f8fafc" />
                            <stop offset="1" stopColor="#8a8a8a" />
                        </linearGradient>
                    </defs>
                    <path className="health-hud__inset" d={insetPath} fill="none" vectorEffect="non-scaling-stroke" />
                    <path d={framePath} fill="none" stroke={`url(#${frameGradientId})`} vectorEffect="non-scaling-stroke" />
                </svg>
            </div>
        </section>
    );
};
