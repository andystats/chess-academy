import { useParams } from 'react-router-dom';
import { getContent } from '../content/registry.js';
import LessonView from '../components/LessonView.jsx';
import BackLink from '../components/ui/BackLink.jsx';
import NotFoundPage from './NotFoundPage.jsx';

// Lesson ids contain slashes (for example "classics/the-center"), so the route is /lesson/* and the
// content id comes from React Router's splat parameter.
export default function LessonPage() {
  const id = useParams()['*'];
  const lesson = getContent(id);
  if (!lesson || lesson.kind !== 'lesson') return <NotFoundPage />;

  return (
    <div className="paper-texture min-h-[calc(100vh-4rem)] bg-[#fbfaf4]">
      <BackLink to="/my-system" label="My System study room" />
      <LessonView key={lesson.id} lesson={lesson} />
    </div>
  );
}
