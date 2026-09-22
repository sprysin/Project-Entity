import BackToHubButton from '../common/BackToHubButton';
import React, { useState } from 'react';
import { getSettings, saveSettings } from '../../desktop/storage';

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

  return <main className="flex-1 overflow-y-auto bg-[#06080b] px-6 py-10 font-roboto retro-hash">
    <div className="mx-auto max-w-3xl">
      <header className="mb-10 flex items-center justify-between gap-4 border-b border-yellow-500/30 pb-7">
        <h1 className="font-orbitron text-3xl font-black text-yellow-500">SETTINGS</h1>
        <BackToHubButton onClick={onBack} disabled={saving} />
      </header>
      <form onSubmit={save} onChange={() => { setMessage(''); setError(''); }}>
        <fieldset disabled={saving} className="space-y-8 border border-slate-700 bg-slate-900/80 p-6">
          <div>
            <label htmlFor="username" className="block font-orbitron text-sm font-bold text-slate-100">Username</label>
            <p id="username-help" className="mt-2 text-sm text-slate-400">[Use up to 24 characters]</p>
            <input id="username" aria-describedby="username-help" type="text" maxLength={24} required value={preferences.username} onChange={event => setPreferences({ ...preferences, username: event.target.value })} className="mt-4 w-full border border-slate-600 bg-slate-950 px-4 py-3 text-slate-100 focus:border-yellow-500 focus:outline-none" />
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="volume" className="font-orbitron text-sm font-bold text-slate-100">Sound volume</label>
              <output htmlFor="volume" className="text-yellow-400">{preferences.volume === 0 ? 'Muted' : `${preferences.volume}%`}</output>
            </div>
            <input id="volume" aria-describedby="volume-help" aria-valuetext={`${preferences.volume}%`} type="range" min={0} max={100} step={1} value={preferences.volume} onChange={event => setPreferences({ ...preferences, volume: Number(event.target.value) })} className="mt-4 w-full accent-yellow-500" />
          </div>
          <button data-sound="select" type="submit" disabled={!preferences.username.trim()} className="bg-yellow-600 px-6 py-3 font-orbitron text-sm font-bold text-white hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'SAVING…' : 'SAVE SETTINGS'}</button>
        </fieldset>
        <p role="status" className="mt-4 text-sm text-yellow-400">{message}</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </form>
    </div>
  </main>;
};

export default Settings;
