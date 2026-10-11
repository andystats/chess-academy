import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MySystemReader from './MySystemReader.jsx';
import { getContent } from '../../content/registry.js';

vi.mock('../BoardPanel.jsx', () => ({
  default: ({ fen }) => <div data-testid="reader-board" data-fen={fen} />,
}));

vi.mock('../../profile/ProfileContext.jsx', () => ({
  useProfile: () => ({
    ready: true,
    recordLessonProgress: vi.fn(),
    getLessonProgress: () => ({ status: 'in-progress', completedStepIds: [] }),
  }),
}));

describe('MySystemReader', () => {
  it('renders a 100th anniversary book chapter with sections, aphorism, and navigation', () => {
    const chapter = getContent('my-system/01-center-and-development');
    expect(chapter).not.toBeNull();

    render(
      <MemoryRouter>
        <MySystemReader chapter={chapter} />
      </MemoryRouter>
    );

    // Header and title
    expect(screen.getByText(/100th Anniversary Centenary Edition/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /The Centre and Development/i })).toBeInTheDocument();
    expect(screen.getByText(/A pawn move must not be considered/i)).toBeInTheDocument();

    // Section 1 is active by default
    expect(screen.getByRole('heading', { level: 3, name: /The Four Central Squares/i })).toBeInTheDocument();
    expect(screen.getByTestId('reader-board')).toHaveAttribute('data-fen', chapter.body.sections[0].initialFen);

    // Switch to section 2
    const section2Button = screen.getByRole('button', { name: /The Spirit of Democracy/i });
    fireEvent.click(section2Button);

    expect(screen.getByRole('heading', { level: 3, name: /The Spirit of Democracy in the Opening/i })).toBeInTheDocument();
  });

  it('switches between Read Mode and Gym Drills Mode', () => {
    const chapter = getContent('my-system/01-center-and-development');
    expect(chapter).not.toBeNull();

    render(
      <MemoryRouter>
        <MySystemReader chapter={chapter} />
      </MemoryRouter>
    );

    // Switch to Gym mode
    const gymButton = screen.getAllByRole('button', { name: /Gym/i })[0];
    fireEvent.click(gymButton);

    expect(screen.getByRole('heading', { level: 2, name: /The Centre and Development Drills/i })).toBeInTheDocument();
  });

  it('renders and steps through illustrative master games when present', () => {
    const chapter = getContent('my-system/16-immortal-zugzwang-and-revolution');
    expect(chapter).not.toBeNull();

    render(
      <MemoryRouter>
        <MySystemReader chapter={chapter} initialMode="games" />
      </MemoryRouter>
    );

    // Should display the master game heading
    expect(screen.getByRole('heading', { level: 2, name: /Friedrich Sämisch vs Aron Nimzowitsch/i })).toBeInTheDocument();
    expect(screen.getByText(/Copenhagen • Result: 0-1/i)).toBeInTheDocument();

    // Click on move 50 (h6)
    const h6Button = screen.getByRole('button', { name: /25\.\.\. h6/i });
    fireEvent.click(h6Button);

    expect(screen.getByText(/The Immortal Zugzwang move/i)).toBeInTheDocument();
  });
});
