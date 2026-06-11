// Shown wherever online play needs the Supabase credentials this build doesn't have. The rest of
// the app (lessons, the engine arena, local two-player) works without them.
export default function RealtimeNotConfigured() {
  return (
    <div className="border-3 border-foreground bg-brand-50/40 p-5 text-sm leading-6 text-gray-700">
      <p className="font-bold text-foreground">Online play isn&rsquo;t configured.</p>
      <p className="mt-2">
        This build has no Supabase credentials, so realtime games can&rsquo;t connect. Set{' '}
        <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> (see{' '}
        <code className="font-mono">.env.example</code>) and reload. Lessons, the engine arena, and
        local two-player all work without it.
      </p>
    </div>
  );
}
