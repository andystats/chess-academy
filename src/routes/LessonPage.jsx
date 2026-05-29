import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getContent } from '../content/registry.js';
import LessonView from '../components/LessonView.jsx';
import NotFoundPage from './NotFoundPage.jsx';

// Lesson ids contain slashes (e.g. "classics/the-center"), so the route is /lesson/* and the id
// is the splat param.
export default function LessonPage() {
  const id = useParams()['*'];
  const lesson = getContent(id);
  if (!lesson || lesson.kind !== 'lesson') return <NotFoundPage />;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600">
          <ChevronLeft size={16} /> All lessons
        </Link>
      </div>
      <LessonView key={lesson.id} lesson={lesson} />
    </div>
  );
}
