import { Routes, Route } from 'react-router-dom';
import AppHeader from './components/AppHeader.jsx';
import HomePage from './routes/HomePage.jsx';
import LessonPage from './routes/LessonPage.jsx';
import MySystemPage from './routes/MySystemPage.jsx';
import TrainingPage from './routes/TrainingPage.jsx';
import GlossaryPage from './routes/GlossaryPage.jsx';
import ArenaPage from './routes/ArenaPage.jsx';
import ScenarioPage from './routes/ScenarioPage.jsx';
import FreePlayPage from './routes/FreePlayPage.jsx';
import ComingSoonPage from './routes/ComingSoonPage.jsx';
import NotFoundPage from './routes/NotFoundPage.jsx';
import { useProfile } from './profile/ProfileContext.jsx';

export default function App() {
  const { ready } = useProfile();

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      {!ready ? (
        <p className="py-20 text-center text-gray-400">Loading…</p>
      ) : (
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/lesson/*" element={<LessonPage />} />
            <Route path="/my-system" element={<MySystemPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/arena/free" element={<FreePlayPage />} />
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
    </div>
  );
}
