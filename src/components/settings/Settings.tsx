import React, { useState } from 'react';
import BackToHubButton from '../common/BackToHubButton';
import { getSettings, saveSettings } from '../../desktop/storage';
import { playSound } from '../../audio';
import './Settings.css';

const Settings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [preferences, setPreferences] = useState(getSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveSettings(preferences);
      setPreferences(getSettings());
      setMessage('Settings saved.');
    } catch {
      setError('Settings could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="settings-page flex-1 overflow-y-auto font-roboto retro-hash">
    <form className="settings-shell" onSubmit={save} onChange={() => { setMessage(''); setError(''); }}>
      <header className="settings-header">
        <div className="settings-heading">
          <h1>SETTINGS</h1>
          <p>Fine-tune your game experience.</p>
        </div>
        <div className="settings-actions">
          <BackToHubButton onClick={onBack} disabled={saving} />
          <button data-sound="select" type="submit" disabled={saving || !preferences.username.trim()} className="settings-save">
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> {saving ? 'SAVING…' : 'SAVE SETTINGS'}
          </button>
        </div>
      </header>

      <div className="settings-feedback" aria-live="polite">
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" className="settings-error">{error}</p>}
      </div>

      <fieldset disabled={saving} className="settings-panel" aria-label="Game preferences">
        <div className="settings-row">
          <div className="settings-copy">
            <label htmlFor="username">Username</label>
            <p id="username-help">Your name in matches · up to 24 characters</p>
          </div>
          <input id="username" aria-describedby="username-help" type="text" maxLength={24} required value={preferences.username} onChange={event => setPreferences({ ...preferences, username: event.target.value })} className="settings-text-input" />
        </div>

        <div className="settings-row">
          <div className="settings-copy">
            <label htmlFor="volume">Sound volume</label>
            <p id="volume-help">Adjust game audio to your liking</p>
          </div>
          <div className="settings-volume">
            <input
              id="volume" aria-describedby="volume-help" aria-valuetext={preferences.volume === 0 ? 'Muted' : `${preferences.volume}%`}
              type="range" min={0} max={100} step={1} value={preferences.volume}
              onChange={event => setPreferences({ ...preferences, volume: Number(event.target.value) })}
              onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerUp={event => playSound('select-small', Number(event.currentTarget.value))}
              onKeyUp={event => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
                  playSound('select-small', Number(event.currentTarget.value));
                }
              }}
            />
            <output htmlFor="volume">{preferences.volume === 0 ? 'Muted' : `${preferences.volume}%`}</output>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-copy">
            <label htmlFor="fanned-out-piles">Fanned out Discard &amp; Void Pile</label>
            <p id="fanned-out-piles-help">Show the four most recent cards in each pile. When off, show only the latest card.</p>
          </div>
          <input id="fanned-out-piles" data-sound="toggle" type="checkbox" aria-describedby="fanned-out-piles-help" checked={preferences.fannedOutPiles} onChange={event => setPreferences({ ...preferences, fannedOutPiles: event.target.checked })} className="settings-toggle" />
        </div>
      </fieldset>
    </form>
  </main>;
};

export default Settings;
