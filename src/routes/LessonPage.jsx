import { useParams, useSearchParams } from 'react-router-dom';
import { getContent } from '../content/registry.js';
import LessonView from '../components/LessonView.jsx';
import MySystemReader from '../components/book/MySystemReader.jsx';
import BackLink from '../components/ui/BackLink.jsx';
import NotFoundPage from './NotFoundPage.jsx';

// Lesson ids contain slashes (for example "classics/the-center" or "my-system/01-center-and-development"),
// so the route is /lesson/* and the content id comes from React Router's splat parameter.
export default function LessonPage() {
  const id = useParams()['*'];
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'read';

  const content = getContent(id);
  if (!content) return <NotFoundPage />;

  if (content.kind === 'bookChapter') {
    return <MySystemReader key={content.id} chapter={content} initialMode={mode} />;
  }

  if (content.kind === 'lesson') {
    return (
      <div className="paper-texture min-h-[calc(100vh-4rem)] bg-[#fbfaf4]">
        <BackLink to="/my-system" label="My System study room" />
        <LessonView key={content.id} lesson={content} />
      </div>
    );
  }

  return <NotFoundPage />;
}
