import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
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

vi.mock('./components/BoardPanel.jsx', () => ({
  default: ({ fen }) => <div data-testid="study-board" data-fen={fen} />,
}));

vi.mock('./engine/useStockfish.js', () => ({
  useStockfish: () => ({
    ready: true,
    error: null,
    requestMove: vi.fn(() => new Promise(() => {})),
    setStrength: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

vi.mock('./engine/useStockfishAnalysis.js', () => ({
  useStockfishAnalysis: ({ fen }) => ({
    fen,
    status: 'complete',
    learnerSide: 'white',
    depthSnapshots: [],
    staticEvaluation: null,
    bestMove: null,
    error: null,
    cached: false,
    cancel: vi.fn(),
    retry: vi.fn(),
  }),
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('application routes', () => {
  beforeEach(() => {
    profileMocks.recordLessonProgress.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Live Chess Coach route and redirects legacy /my-system links to /coach', () => {
    renderAt('/my-system');
    expect(screen.getByRole('heading', { level: 1, name: /Live Chess Coach/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What to Think About Now/i })).toBeInTheDocument();
  });

  it('renders a scenario lesson, resolves its inline glossary term, advances, and records progress', async () => {
    renderAt('/lesson/classics/the-center');

    expect(await screen.findByRole('heading', { level: 1, name: 'Meet the center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Practice Arena/i })).toHaveAttribute('href', '/arena');

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
