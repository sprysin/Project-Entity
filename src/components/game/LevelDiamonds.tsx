import React from 'react';

export function LevelDiamonds({ required, selected }: { required: number; selected: number }) {
    return <div className={`level-diamonds ${selected > required ? 'is-overfilled' : ''}`} role="progressbar"
        aria-label="Contract tribute levels" aria-valuemin={0} aria-valuemax={required}
        aria-valuenow={Math.min(selected, required)} aria-valuetext={`${selected} of ${required} levels selected`}>
        {Array.from({ length: required }, (_, index) => <span key={index} className={index < selected ? 'is-filled' : ''}
            aria-hidden="true" />)}
    </div>;
}
