import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { flattenMySystemChapters } from './content/mySystem.js';
import { freshProgress } from './profile/progress.js';

const profileMocks = vi.hoisted(() => ({
  recordLessonProgress: vi.fn(),
}));

vi.mock('./profile/ProfileContext.jsx', () => ({
  useProfile: () => ({
    ready: true,
    recordLessonProgress: profileMocks.recordLessonProgress,
    getLessonProgress: () => freshProgress('test'),
  }),
}));

// Route tests exercise study composition and content without depending on react-chessboard's browser
// measurements. Board behavior has its own controller and style tests.
vi.mock('./components/BoardPanel.jsx', () => ({
  default: ({ fen }) => <div data-testid="study-board" data-fen={fen} />,
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('restored study routes', () => {
  beforeEach(() => {
    profileMocks.recordLessonProgress.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the My System chapter map with working studies and chapters', () => {
    renderAt('/my-system');

    expect(screen.getByRole('heading', { level: 1, name: /My System/i })).toBeInTheDocument();
    const readLinks = screen
      .getAllByRole('link', { name: /Read Chapter/i })
      .map((link) => link.getAttribute('href'));
    const linkedChapters = flattenMySystemChapters().filter((chapter) => chapter.lessonId);

    expect(readLinks).toHaveLength(linkedChapters.length);
    for (const chapter of linkedChapters) {
      expect(readLinks).toContain(`/lesson/${chapter.lessonId}`);
    }
  });

  it('renders a lesson, resolves its inline glossary term, advances, and records progress', async () => {
    renderAt('/lesson/classics/the-center');

    expect(await screen.findByRole('heading', { level: 1, name: 'Meet the center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My System study room/i })).toHaveAttribute('href', '/my-system');

    fireEvent.click(screen.getByRole('button', { name: 'center' }));
    expect(
      screen.getByText('The four squares in the middle of the board: e4, d4, e5, and d5.'),
    ).toBeInTheDocument();

    await waitFor(() => expect(profileMocks.recordLessonProgress).toHaveBeenCalled());
    const [lesson, updateProgress] = profileMocks.recordLessonProgress.mock.calls[0];
    const progress = updateProgress(freshProgress('test'), 1234);
    expect(lesson.id).toBe('classics/the-center');
    expect(progress.completedStepIds).toContain('intro');
    expect(progress.updatedAt).toBe(1234);

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Grab a center square' })).toBeInTheDocument();
  });
});
