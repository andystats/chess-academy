import { useState, useRef } from 'react';
import clsx from 'clsx';
import { Upload, Plus } from 'lucide-react';
import { useProfile, AVATARS } from './ProfileContext.jsx';

export default function PickProfile() {
  const { profiles, selectProfile, createProfile, importProfile, persistent } = useProfile();
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    createProfile(name, avatar);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProfile(file);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-center font-display text-3xl font-bold text-gray-900">Choose a profile</h1>
      <p className="mt-2 text-center text-gray-600">Keep progress separate for each learner.</p>

      {!persistent && (
        <p className="mx-auto mt-4 max-w-md rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Heads up: storage is turned off in this browser, so progress won&apos;t be saved after you close the tab.
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectProfile(p.id)}
            className="flex w-28 flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-5xl" aria-hidden>{p.avatar}</span>
            <span className="truncate font-semibold text-gray-800">{p.name}</span>
          </button>
        ))}

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 p-4 text-gray-400 hover:border-brand-300 hover:text-brand-600"
          >
            <Plus size={32} />
            <span className="font-semibold">New profile</span>
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={submit} className="mx-auto mt-8 max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leo"
            maxLength={20}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-brand-400 focus:outline-none"
            autoFocus
          />
          <p className="mt-4 text-sm font-semibold text-gray-700">Pick an avatar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={clsx(
                  'flex h-12 w-12 items-center justify-center rounded-xl border text-2xl',
                  avatar === a ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300',
                )}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button type="submit" className="min-h-touch rounded-2xl bg-gray-950 px-6 font-semibold text-white hover:bg-brand-700">
              Start studying
            </button>
            {profiles.length > 0 && (
              <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600"
        >
          <Upload size={16} /> Import a saved profile
        </button>
        <input ref={fileInput} type="file" accept="application/json" className="hidden" onChange={onImport} />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
