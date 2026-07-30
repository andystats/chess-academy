const WORK = Object.freeze({
  author: 'Aron Nimzowitsch',
  title: 'My System',
  year: 1930,
});

function citation(part, chapter, chapterTitle) {
  return Object.freeze({
    ...WORK,
    part,
    chapter,
    chapterTitle,
    label: `${WORK.author}, ${WORK.title} (${WORK.year}), ${part}, Chapter ${chapter}: ${chapterTitle}.`,
  });
}

function card(definition) {
  return Object.freeze({
    ...definition,
    aliases: Object.freeze([...definition.aliases]),
    tags: Object.freeze([...definition.tags]),
    principles: Object.freeze([...definition.principles]),
    questions: Object.freeze([...definition.questions]),
  });
}

/**
 * Public-safe coaching notes inspired by the chapter structure of the 1930 work.
 *
 * Every explanation below was written for Chess Academy. The cards contain no quotations,
 * page-level references, OCR, or prose imported from a modern edition.
 */
export const coachKnowledgeCards = Object.freeze([
  card({
    id: 'center-and-development',
    title: 'Center and development',
    aliases: [
      'center',
      'centre',
      'development',
      'centre and development',
      'central control',
      'rapid development',
      'develop the whole army',
      'opening piece coordination',
      'bring out my pieces',
    ],
    tags: ['opening', 'center', 'development', 'tempo', 'coordination'],
    summary:
      'Opening development is a coordination race. Claim enough central influence to give your pieces useful routes, then bring the army into contact so the pieces can support one another. Repeated moves by one piece need a concrete payoff because the rest of the position is still waiting to join the game.',
    principles: [
      'Count undeveloped pieces before beginning an attack.',
      'Prefer pawn moves that open a route, support central control, or challenge the opponent’s center.',
      'Judge a tempo by how much it improves the coordination of the whole position.',
    ],
    questions: [
      'Which piece is still standing where it began?',
      'What central break would make development easier?',
      'Does this move improve the army or only one already-active piece?',
    ],
    citation: citation('Part I', 1, 'The Centre and Development'),
  }),
  card({
    id: 'open-files',
    title: 'Open files',
    aliases: [
      'open file',
      'rook file',
      'rook highway',
      'double the rooks',
      'file entry square',
      'rook penetration',
    ],
    tags: ['middlegame', 'rook', 'file', 'entry square', 'invasion'],
    summary:
      'An open file is a route rather than a trophy. A rook is useful there when it can create a target, control an entry square, or enter the opposing camp. Secure access first; only then decide whether doubling rooks or switching to another file produces a real gain.',
    principles: [
      'Identify the square where control of the file can become an invasion.',
      'Remove or distract the piece that guards the entry square.',
      'Do not stack rooks on a file that leads to no target or useful transfer.',
    ],
    questions: [
      'Where can a rook enter after taking the file?',
      'Which defender blocks that entry?',
      'Would a different file give the rook a clearer job?',
    ],
    citation: citation('Part I', 2, 'The Open File'),
  }),
  card({
    id: 'blockade',
    title: 'Blockade',
    aliases: [
      'blockading a passed pawn',
      'stop a passer',
      'stop the passed pawn',
      'piece in front of a pawn',
      'blockading square',
      'restrain a passed pawn',
    ],
    tags: ['middlegame', 'endgame', 'passed pawn', 'blockader', 'restraint'],
    summary:
      'A passed pawn becomes less mobile when a piece occupies the square directly in front of it. The best blockader is stable there and can still influence play elsewhere. Establish the stop early, then attack the pawn or use the fixed structure to improve the rest of the position.',
    principles: [
      'Put the blockade in place before the pawn advances with tempo.',
      'Choose a blockading piece that is hard to chase and still has active work.',
      'Once the passer is fixed, bring another unit to attack it or create play on the other wing.',
    ],
    questions: [
      'What is the pawn’s next safe advance?',
      'Which piece can occupy the square in front without becoming passive?',
      'After the blockade is secure, where should the next attacker go?',
    ],
    citation: citation('Part I', 4, 'The Passed Pawn'),
  }),
  card({
    id: 'pawn-chains',
    title: 'Pawn chains',
    aliases: [
      'pawn chain',
      'attack the chain base',
      'base of the pawn chain',
      'pawn-chain break',
      'linked pawns',
      'head of the chain',
    ],
    tags: ['middlegame', 'pawn', 'chain', 'base', 'pawn break'],
    summary:
      'A fixed pawn chain divides the board into a supported front and a base that may be difficult to reinforce. Pressure usually works best against the base, while a well-timed pawn break can change the direction of the struggle. The chain’s shape also hints at the wing where each side has more space.',
    principles: [
      'Trace the chain backward to find the pawn with no pawn defender.',
      'Prepare a pawn break that challenges the chain rather than pushing into its strongest point.',
      'Reassess the target whenever an exchange changes the chain’s shape.',
    ],
    questions: [
      'Which pawn is the base of the chain?',
      'What pawn break can reach that base?',
      'If the chain changes, which side of the board becomes easier to play on?',
    ],
    citation: citation('Part I', 9, 'The Pawn Chain'),
  }),
  card({
    id: 'prophylaxis',
    title: 'Prophylaxis',
    aliases: [
      'preventive play',
      'prevent the opponent plan',
      'stop their plan',
      'what does my opponent want',
      'opponent best reply',
      'restrict counterplay',
    ],
    tags: ['middlegame', 'prevention', 'opponent plan', 'restriction', 'flexibility'],
    summary:
      'Prophylactic thinking begins by finding the opponent’s most useful freeing move or improvement. A strong preventive move reduces that option while keeping your own position flexible. The goal is not to answer every imaginable threat, but to remove the counterplay that would interfere with your plan.',
    principles: [
      'Name the opponent’s best improving move before choosing your own.',
      'Prefer prevention that also improves a piece, controls a break, or creates useful waiting time.',
      'Do not spend a tempo stopping an idea that is harmless or impossible.',
    ],
    questions: [
      'What would the opponent play if given a free move?',
      'Which pawn break or piece improvement would release their position?',
      'Can one move restrict that idea while advancing my own plan?',
    ],
    citation: citation('Part II', 1, 'Prophylaxis and the Centre'),
  }),
  card({
    id: 'overprotection',
    title: 'Overprotection',
    aliases: [
      'overprotect a strong point',
      'defend a strong point twice',
      'extra defenders',
      'support a key square',
      'reinforce the center',
      'reinforce the centre',
    ],
    tags: ['middlegame', 'strong point', 'defender', 'coordination', 'central square'],
    summary:
      'Overprotection gives an important square or pawn more support than immediate tactics require. The extra defenders form a coordinated network and may gain freedom to take on new jobs. The method is worthwhile only when the protected point is central to the position’s activity or stability.',
    principles: [
      'Choose a strong point that anchors space, mobility, or a useful piece.',
      'Use defenders that become more active as they reinforce the point.',
      'Avoid collecting passive defenders around a point that the opponent can simply ignore.',
    ],
    questions: [
      'Which square holds the position together?',
      'Can another defender improve itself while adding support?',
      'What new job can an existing defender take once support is abundant?',
    ],
    citation: citation('Part II', 4, 'Overprotection and Weak Pawns'),
  }),
]);

const cardsById = new Map(coachKnowledgeCards.map((entry) => [entry.id, entry]));

/** Return a public coach knowledge card by stable id, or null when it is unknown. */
export function getCoachKnowledgeCard(id) {
  return cardsById.get(id) ?? null;
}
