import { useParams } from 'react-router-dom';
import { getContent } from '../content/registry.js';
import LessonView from '../components/LessonView.jsx';
import BackLink from '../components/ui/BackLink.jsx';
import NotFoundPage from './NotFoundPage.jsx';

// Lesson ids contain slashes (e.g. "classics/the-center"), so the route is /lesson/* and the id
// is the splat param.
export default function LessonPage() {
  const id = useParams()['*'];
  const lesson = getContent(id);
  if (!lesson || lesson.kind !== 'lesson') return <NotFoundPage />;

  return (
    <div>
      <BackLink to="/" label="Atrium" />
      <LessonView key={lesson.id} lesson={lesson} />
    </div>
  );
}
