import { coachKnowledgeCards, getCoachKnowledgeCard } from '../content/coach/knowledgeCards.js';

/**
 * Expanded strategy, opening, tactical, and endgame reference library for the AI Coach.
 * Combines the six original My System cards with classic principles from opening theory,
 * middlegame planning, tactical motifs, and endgame technique.
 */
export const EXTENDED_STRATEGY_CARDS = Object.freeze([
  ...coachKnowledgeCards,
  Object.freeze({
    id: 'king-safety-castling',
    title: 'King safety and timely castling',
    aliases: [
      'castle',
      'castling',
      'king safety',
      'uncastled king',
      'king in the center',
      'connect the rooks',
      'shelter the king',
    ],
    tags: ['opening', 'middlegame', 'king safety', 'castling', 'rooks'],
    summary:
      'An uncastled king in the center is a tactical magnet. Castling accomplishes two vital tasks in a single tempo: it tucks the king behind a pawn shelter and brings a rook toward the central files to neutralize flank or central threats.',
    principles: [
      'Castle early before opening central files with pawn breaks.',
      'When under flank attack (such as pressure on b2, b7, f2, or f7), check whether castling neutralizes the threat while improving coordination.',
      'Delay castling only when the center is locked or a concrete tactical sequence demands immediate action.',
    ],
    questions: [
      'Is my king safe if the center opens on the next move?',
      'Does castling neutralize an immediate threat while activating a rook?',
      'Which flank offers the safest shelter for my king?',
    ],
    citation: Object.freeze({
      author: 'Aron Nimzowitsch & Classical Opening Theory',
      title: 'My System & Opening Principles',
      year: 1930,
      part: 'Part I',
      chapter: 1,
      chapterTitle: 'The Centre, Development, and King Safety',
      label: 'Classical Opening Theory & Nimzowitsch, My System (1930): Development and King Safety.',
    }),
  }),
  Object.freeze({
    id: 'checks-captures-threats',
    title: 'Checks, captures, and threats',
    aliases: [
      'checks captures threats',
      'tactical scan',
      'forcing moves',
      'loose pieces',
      'undefended piece',
      'hanging piece',
      'blunder check',
    ],
    tags: ['tactics', 'calculation', 'threats', 'hanging', 'forcing'],
    summary:
      'Every turn begins with a forcing-move scan: examine checks, captures, and direct threats for both sides. Most tactical blows happen when an undefended piece or weakly guarded square (like b2, b7, f2, or f7) is overloaded.',
    principles: [
      'Identify the opponent’s most dangerous threat before falling in love with your own plan.',
      'Undefended pieces ("loose pieces") are the glue of combinations—keep yours protected and target theirs.',
      'When neutralizing a threat, prefer a defense that also develops a piece or creates a counter-threat.',
    ],
    questions: [
      'What is my opponent threatening if they had another move right now?',
      'Are any of my pieces or pawns undefended?',
      'Can I defend the threat while simultaneously improving a piece?',
    ],
    citation: Object.freeze({
      author: 'Tactical & Calculation Canon',
      title: 'Forcing Moves & Threat Awareness',
      year: 1930,
      part: 'Tactics',
      chapter: 1,
      chapterTitle: 'Forcing Moves and Loose Pieces',
      label: 'Tactical Canon (after Nimzowitsch, Korchnoi & Nunn): Loose Pieces and Threat Neutralization.',
    }),
  }),
  Object.freeze({
    id: 'pins-and-discoveries',
    title: 'Pins, skewers, and discovered attacks',
    aliases: [
      'pin',
      'pinned piece',
      'skewer',
      'discovered attack',
      'discovered check',
      'x-ray attack',
      'unpin',
    ],
    tags: ['tactics', 'pin', 'discovered attack', 'geometry', 'middlegame'],
    summary:
      'A pinned piece loses its power to move and defend. By piling pressure onto a pinned unit with pawns and minor pieces—or by breaking a pin before the opponent can add another attacker—you control the tactical geometry of the board.',
    principles: [
      'Attack a pinned piece with your lowest-value units (especially pawns) rather than trading immediately.',
      'Remember that a pinned piece does not truly defend the squares it appears to cover.',
      'When your own piece is pinned, look to unpin by castling, interposing, or questioning the pinning piece.',
    ],
    questions: [
      'Which piece is immobilized by a pin along a file or diagonal?',
      'Can I add another attacker to the pinned target?',
      'Does castling or stepping aside break an uncomfortable pin?',
    ],
    citation: Object.freeze({
      author: 'Aron Nimzowitsch',
      title: 'My System',
      year: 1930,
      part: 'Part I',
      chapter: 7,
      chapterTitle: 'The Pinned Piece & Discovered Check',
      label: 'Aron Nimzowitsch, My System (1930), Part I, Chapters 7–8: The Pinned Piece & Discovered Check.',
    }),
  }),
  Object.freeze({
    id: 'outposts-and-seventh-rank',
    title: 'Outposts and seventh-rank invasion',
    aliases: [
      'outpost',
      'knight outpost',
      'seventh rank',
      '7th rank',
      'pigs on the seventh',
      'invasion square',
      'weak square',
    ],
    tags: ['middlegame', 'outpost', 'knight', 'rook', 'seventh rank'],
    summary:
      'Open files and weak squares need concrete destinations. A knight anchored on an advanced outpost (guarded by a pawn and immune to enemy pawns) or a rook reaching the seventh rank ties down the opponent’s entire defense.',
    principles: [
      'Establish knights on advanced squares in the 5th or 6th rank where no enemy pawn can chase them.',
      'Use open files as highways to reach the 7th or 8th rank and attack unmoved enemy pawns from the side.',
      'Trade off the opponent’s defender that controls your key outpost square.',
    ],
    questions: [
      'Which advanced square cannot be guarded by an opponent pawn?',
      'Can my rook penetrate to the seventh rank along an open file?',
      'Which enemy piece is guarding the entry square?',
    ],
    citation: Object.freeze({
      author: 'Aron Nimzowitsch',
      title: 'My System',
      year: 1930,
      part: 'Part I',
      chapter: 3,
      chapterTitle: 'The Seventh and Eighth Ranks & Outposts',
      label: 'Aron Nimzowitsch, My System (1930), Part I, Chapters 2–3: Outposts and the Seventh Rank.',
    }),
  }),
  Object.freeze({
    id: 'endgame-king-and-two-weaknesses',
    title: 'Endgame king activity and two weaknesses',
    aliases: [
      'endgame',
      'king activity',
      'centralize the king',
      'opposition',
      'two weaknesses',
      'rook behind passed pawn',
      'tarrasch rule',
    ],
    tags: ['endgame', 'king', 'passed pawn', 'technique', 'weaknesses'],
    summary:
      'Once the queens leave the board, the king transforms from a sheltered target into an active fighting piece. Centralize your king immediately, place rooks behind passed pawns, and stretch the opponent’s defense between two separate weaknesses.',
    principles: [
      'March the king toward the center and the critical pawns as soon as the endgame begins.',
      'Place rooks behind passed pawns—yours or the opponent’s—so their scope grows as the pawn moves.',
      'When one weakness is defended, open a second front on the opposite wing to overload the defenders.',
    ],
    questions: [
      'Can my king take a step toward the center or the opponent’s pawns?',
      'Are my rooks placed behind the most important passed pawn?',
      'Where can I create a second weakness to stretch the defense?',
    ],
    citation: Object.freeze({
      author: 'Aron Nimzowitsch & José Raúl Capablanca',
      title: 'My System & Chess Fundamentals',
      year: 1930,
      part: 'Part I',
      chapter: 6,
      chapterTitle: 'Elements of Endgame Strategy',
      label: 'Nimzowitsch, My System (1930), Ch. 6 & Capablanca, Chess Fundamentals: Endgame Strategy.',
    }),
  }),
]);

const extendedById = new Map(EXTENDED_STRATEGY_CARDS.map((card) => [card.id, card]));

export function getStrategyCard(id) {
  return extendedById.get(id) ?? getCoachKnowledgeCard(id) ?? null;
}
