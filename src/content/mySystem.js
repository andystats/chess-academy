// Original study-map prose after Aron Nimzowitsch's My System. The structure follows the
// 1930 public-domain English edition closely at the chapter level, while this app keeps lesson
// text and prompts original.

export const MY_SYSTEM_PARTS = [
  {
    id: 'elements',
    title: 'Part I. The Elements',
    summary: 'The strategic vocabulary: center, files, ranks, passed pawns, pins, exchanges, and pawn chains.',
    chapters: [
      {
        id: 'center',
        number: 'I',
        title: 'On the Centre and on Development',
        summary: 'Definitions, first development principles, tempo-gaining exchanges, liquidation, the mobile centre, and the danger of pawn hunting.',
        lessonId: 'classics/the-center',
        status: 'playable',
      },
      {
        id: 'open-files',
        number: 'II',
        title: 'On Open Files',
        summary: 'How open files arise, why invasion is the goal, how to overcome obstructing pawns, and how outposts form in a file.',
        lessonId: 'classics/open-files',
        status: 'playable',
      },
      {
        id: 'seventh-eighth-ranks',
        number: 'III',
        title: 'The 7th and 8th Ranks',
        summary: 'Choosing objectives on the back ranks: converging attacks, revolutionary attacks, perpetual-check devices, and turning movements.',
        lessonId: 'classics/open-files',
        status: 'linked',
      },
      {
        id: 'passed-pawns',
        number: 'IV',
        title: 'The Passed Pawn',
        summary: 'Candidate pawns, obligatory blockade, the blockader’s mission, privileged passers, and when a passed pawn should advance.',
        lessonId: 'classics/blockade',
        status: 'playable',
      },
      {
        id: 'exchanging',
        number: 'V',
        title: 'On Exchanging',
        summary: 'Exchange to seize or open a file, destroy a defender, avoid a loss of tempo, simplify, or fight for a strategic point.',
        lessonId: 'classics/exchanging',
        status: 'playable',
      },
      {
        id: 'endgame-strategy',
        number: 'VI',
        title: 'The Elements of End Game Strategy',
        summary: 'Centralization, active rook placement, rallying isolated detachments, and turning files or ranks into material gains.',
        status: 'planned',
      },
      {
        id: 'pin',
        number: 'VII',
        title: 'The Pin',
        summary: 'The wholly pinned and half-pinned piece, exchange combinations on the pinning square, and practical methods of unpinning.',
        lessonId: 'classics/pin',
        status: 'playable',
      },
      {
        id: 'discovered-checks',
        number: 'VIII',
        title: 'Discovered Checks',
        summary: 'The tactical sibling of the pin: choice of discovered-check moves, seesaw attacks, and double-check themes.',
        lessonId: 'classics/discovered-checks',
        status: 'playable',
      },
      {
        id: 'pawn-chain',
        number: 'IX',
        title: 'The Pawn Chain',
        summary: 'Definitions, the base, the two theatres of war, blockade rules applied to chains, siege warfare, and transfer to new targets.',
        lessonId: 'classics/pawn-chain',
        status: 'playable',
      },
    ],
  },
  {
    id: 'positional-play',
    title: 'Part II. Positional Play',
    summary: "The elements become a method: prophylaxis, restraint, overprotection, centre play, pawn-structure weaknesses, and maneuvering.",
    chapters: [
      {
        id: 'position-play-center',
        number: 'I',
        title: 'The Conception of Position Play and the Problem of the Centre',
        summary: 'Eliminate the urge to always “do something,” use prophylactic measures, overprotect important points, and watch the centre.',
        lessonId: 'classics/prophylaxis',
        status: 'playable',
      },
      {
        id: 'doubled-pawn-restraint',
        number: 'II',
        title: 'The Doubled Pawn and Restraint',
        summary: 'Static and dynamic weaknesses, double complexes, mysterious rook moves, freeing moves, and restraint of pawn majorities.',
        lessonId: 'classics/blockade',
        status: 'linked',
      },
      {
        id: 'isolated-queen-pawn',
        number: 'III',
        title: "The Isolated Queen's Pawn",
        summary: 'The isolani as dynamic strength, endgame weakness, attacking weapon, source of reflex weaknesses, and gateway to hanging pawns.',
        status: 'planned',
      },
      {
        id: 'two-bishops',
        number: 'IV',
        title: 'The Two Bishops',
        summary: 'The bishop pair, Horwitz bishops, pawn clamps supported by bishops, restraining knights, and bishop-pair endgames.',
        lessonId: 'classics/mobility',
        status: 'linked',
      },
      {
        id: 'overprotection',
        number: 'V',
        title: 'Over-Protection',
        summary: 'Systematic surplus defense of strong points: the pawn-chain base, central points, and king-sheltering centre control.',
        lessonId: 'classics/overprotection',
        status: 'playable',
      },
      {
        id: 'maneuvering',
        number: 'VI',
        title: 'Maneuvering Against Enemy Weaknesses',
        summary: 'The terrain, the pivot, combined play on both wings, latent weaknesses, and maneuvering under central pressure.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'illustrative-games',
    title: 'Part III. Illustrative Games',
    summary: 'Fifty annotated career games used as case files, each revisiting the earlier principles on a living board.',
    chapters: [
      {
        id: 'case-files',
        number: 'XIII',
        title: 'Game Case Files',
        summary: 'Annotated games will connect the chapter ideas to full-game decisions and turning points.',
        status: 'planned',
      },
    ],
  },
];

export function flattenMySystemChapters() {
  return MY_SYSTEM_PARTS.flatMap((part) => part.chapters.map((chapter) => ({ ...chapter, part })));
}
