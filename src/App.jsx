import { Navigate, Routes, Route } from 'react-router-dom';
import AppHeader from './components/AppHeader.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ArenaPage from './routes/ArenaPage.jsx';
import ScenarioPage from './routes/ScenarioPage.jsx';
import FreePlayPage from './routes/FreePlayPage.jsx';
import OnlineLobbyPage from './routes/OnlineLobbyPage.jsx';
import OnlinePlayPage from './routes/OnlinePlayPage.jsx';
import ComingSoonPage from './routes/ComingSoonPage.jsx';
import NotFoundPage from './routes/NotFoundPage.jsx';
import { useProfile } from './profile/ProfileContext.jsx';
import VersionStamp from './components/VersionStamp.jsx';

export default function App() {
  const { ready } = useProfile();

  return (
    <div className="min-h-screen bg-white">
      <ErrorBoundary>
        <AppHeader />
        {!ready ? (
          <p className="py-20 text-center text-gray-400">Loading…</p>
        ) : (
          <main>
            <Routes>
              <Route path="/" element={<ArenaPage />} />
              <Route path="/training" element={<Navigate to="/" replace />} />
              <Route path="/lesson/*" element={<Navigate to="/" replace />} />
              <Route path="/my-system" element={<Navigate to="/" replace />} />
              <Route path="/glossary" element={<Navigate to="/" replace />} />
              <Route path="/arena" element={<ArenaPage />} />
              <Route path="/arena/free" element={<FreePlayPage />} />
              <Route path="/arena/online" element={<OnlineLobbyPage />} />
              <Route path="/play/:gameId" element={<OnlinePlayPage />} />
              <Route path="/arena/scenario/*" element={<ScenarioPage />} />
              <Route
                path="/puzzles"
                element={<ComingSoonPage title="Puzzles" blurb="A puzzle trainer with friendly difficulty levels is coming soon." />}
              />
              <Route
                path="/reference/:section"
                element={<ComingSoonPage title="Reference" blurb="Openings, middlegame, endgame, and pawn structure guides are on the way." />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        )}
        <VersionStamp />
      </ErrorBoundary>
    </div>
  );
}
