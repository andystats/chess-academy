// A tiny build stamp pinned to the corner so you can tell at a glance which commit is actually
// deployed — a static package version wouldn't change per deploy. The values are injected at build
// time (vite.config.js): the short SHA matches the GitHub commit, and the build time rides in the
// hover tooltip.
const VERSION = import.meta.env.VITE_APP_VERSION;
const SHA = import.meta.env.VITE_GIT_SHA;
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME;

export default function VersionStamp() {
  if (!VERSION && !SHA) return null;
  const label = SHA && SHA !== 'dev' ? `v${VERSION} · ${SHA}` : `v${VERSION}`;
  const built = BUILD_TIME ? `Built ${new Date(BUILD_TIME).toLocaleString()}` : undefined;
  return (
    <div
      title={built}
      className="fixed bottom-2 right-2 z-20 select-none font-mono text-[10px] tracking-tight text-gray-400/70 transition-colors hover:text-gray-500"
    >
      {label}
    </div>
  );
}
