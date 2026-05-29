import { Routes, Route } from 'react-router-dom';
import AppHeader from './components/AppHeader.jsx';
import HomePage from './routes/HomePage.jsx';
import LessonPage from './routes/LessonPage.jsx';
import GlossaryPage from './routes/GlossaryPage.jsx';
import ComingSoonPage from './routes/ComingSoonPage.jsx';
import NotFoundPage from './routes/NotFoundPage.jsx';
import PickProfile from './profile/PickProfile.jsx';
import { useProfile } from './profile/ProfileContext.jsx';

export default function App() {
  const { ready, activeProfile } = useProfile();

  return (
    <div className="min-h-screen bg-brand-50/40">
      <AppHeader />
      {!ready ? (
        <p className="py-20 text-center text-gray-400">Loading…</p>
      ) : !activeProfile ? (
        <PickProfile />
      ) : (
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lesson/*" element={<LessonPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
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
    </div>
  );
}
