// Original study-map prose after Aron Nimzowitsch's My System. The structure follows the
// public-domain book at a high level, while this app keeps lesson text and prompts original.

export const MY_SYSTEM_PARTS = [
  {
    id: 'elements',
    title: 'Part I. The Elements',
    summary: 'The strategic vocabulary: center, files, ranks, passed pawns, pins, exchanges, and pawn chains.',
    chapters: [
      {
        id: 'center',
        number: 'I',
        title: 'The Center',
        summary: 'Control the middle directly with pawns or indirectly with pieces, then build development around that claim.',
        lessonId: 'classics/the-center',
        status: 'playable',
      },
      {
        id: 'open-files',
        number: 'II',
        title: 'Open Files',
        summary: 'Create roads for rooks, occupy them, and convert file control into entry squares.',
        lessonId: 'classics/open-files',
        status: 'playable',
      },
      {
        id: 'seventh-eighth-ranks',
        number: 'III',
        title: 'Seventh and Eighth Ranks',
        summary: 'Once a rook enters the back ranks, pawns become targets and the king loses room.',
        lessonId: 'classics/open-files',
        status: 'linked',
      },
      {
        id: 'passed-pawns',
        number: 'IV',
        title: 'Passed Pawns',
        summary: 'A passed pawn is both a runner and a weakness; the key question is whether it can be restrained.',
        lessonId: 'classics/blockade',
        status: 'playable',
      },
      {
        id: 'pin',
        number: 'V',
        title: 'The Pin',
        summary: 'A pinned piece loses freedom because moving it would expose something more valuable.',
        lessonId: 'classics/pin',
        status: 'playable',
      },
      {
        id: 'discovered-checks',
        number: 'VI',
        title: 'Discovered Checks',
        summary: 'A moving piece can reveal force behind it, turning development and attack into one gesture.',
        lessonId: 'classics/discovered-checks',
        status: 'playable',
      },
      {
        id: 'exchanging',
        number: 'VII',
        title: 'Exchanging',
        summary: 'Trades are not automatic; every exchange changes tempo, structure, defenders, and future targets.',
        lessonId: 'classics/exchanging',
        status: 'playable',
      },
      {
        id: 'pawn-chain',
        number: 'VIII',
        title: 'The Pawn Chain',
        summary: 'Pawn chains point toward plans: attack the base, restrain the advance, and read the direction of play.',
        lessonId: 'classics/pawn-chain',
        status: 'playable',
      },
    ],
  },
  {
    id: 'positional-play',
    title: 'Part II. Positional Play',
    summary: "The elements become habits: restrain, blockade, overprotect, improve mobility, and answer the opponent's plan.",
    chapters: [
      {
        id: 'prophylaxis',
        number: 'IX',
        title: 'Prophylaxis',
        summary: "Before choosing your plan, identify the opponent's best improvement and make it fail.",
        lessonId: 'classics/prophylaxis',
        status: 'playable',
      },
      {
        id: 'restraint-blockade',
        number: 'X',
        title: 'Restraint and Blockade',
        summary: 'Stop the pawn, occupy its path, then attack it once its motion has been removed.',
        lessonId: 'classics/blockade',
        status: 'playable',
      },
      {
        id: 'overprotection',
        number: 'XI',
        title: 'Overprotection',
        summary: 'Important squares deserve surplus defense because extra defenders become free, coordinated pieces.',
        lessonId: 'classics/overprotection',
        status: 'playable',
      },
      {
        id: 'mobility',
        number: 'XII',
        title: 'Mobility',
        summary: 'A position is healthy when the pieces have useful choices and no single point is overloaded.',
        lessonId: 'classics/mobility',
        status: 'playable',
      },
    ],
  },
  {
    id: 'illustrative-games',
    title: 'Part III. Illustrative Games',
    summary: 'Complete games as case files, each revisiting the earlier principles on a living board.',
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
