import React from 'react';
import './PageChrome.css';

export default function BackToHubButton({ onClick, disabled = false, label = 'Back to menu' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <button
    data-sound="cancellation"
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="page-back-button"
  >
    <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {label}
  </button>;
}
