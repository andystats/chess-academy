import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Markdown from './Markdown.jsx';

describe('Markdown', () => {
  it('renders **bold** runs as <strong>', () => {
    render(<Markdown>{'plain **bold** text'}</Markdown>);
    const strong = screen.getByText('bold');
    expect(strong.tagName).toBe('STRONG');
  });

  it('splits paragraphs on blank lines', () => {
    const { container } = render(<Markdown>{'one\n\ntwo'}</Markdown>);
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('renders [[term]] via renderTerm with the display text', () => {
    render(
      <Markdown renderTerm={({ slug, display }) => <em data-slug={slug}>{display}</em>}>
        {'see the [[center|middle]] here'}
      </Markdown>,
    );
    const term = screen.getByText('middle');
    expect(term.tagName).toBe('EM');
    expect(term.getAttribute('data-slug')).toBe('center');
  });

  it('renders an empty string without crashing', () => {
    const { container } = render(<Markdown>{''}</Markdown>);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
