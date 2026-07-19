// A tiny build stamp pinned to the corner so you can tell at a glance which commit is actually
// deployed — a static package version wouldn't change per deploy. The values are injected at build
// time (vite.config.js): the short SHA matches the GitHub commit, and the build time rides in the
// hover tooltip.
const SHA = import.meta.env.VITE_GIT_SHA;
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME;

export default function VersionStamp() {
  const getFormattedDateVersion = () => {
    const dateSource = BUILD_TIME ? new Date(BUILD_TIME) : new Date();
    const mm = String(dateSource.getMonth() + 1).padStart(2, '0');
    const dd = String(dateSource.getDate()).padStart(2, '0');
    const yyyy = dateSource.getFullYear();
    return `0.${mm}${dd}${yyyy}`;
  };

  const displayVersion = getFormattedDateVersion();
  const label = SHA && SHA !== 'dev' ? `v${displayVersion} · ${SHA}` : `v${displayVersion}`;
  const built = BUILD_TIME ? `Built ${new Date(BUILD_TIME).toLocaleString()}` : undefined;

  return (
    <div
      title={built}
      className="fixed bottom-2 right-2 z-20 select-none font-mono text-[10px] tracking-tight text-gray-400/50 transition-colors hover:text-gray-500"
    >
      {label}
    </div>
  );
}
