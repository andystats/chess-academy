import attackChain from './scenarios/attack-the-chain-base.json';
import blockade from './scenarios/blockade-the-passer.json';
import commandCenter from './scenarios/command-the-center.json';
import openFile from './scenarios/seize-the-open-file.json';
import discovery from './scenarios/spring-the-discovery.json';

// The first Engine X-Ray curriculum. Each position has one sharply framed human question, while
// Stockfish remains free to disagree with the lesson-shaped hunch. `coachCardId` is a bridge to
// the book coach; null deliberately means "calculation lesson, not a My System claim."
export const ENGINE_XRAY_POSITIONS = [
  {
    id: 'prophylaxis-f7',
    title: 'Read the Threat',
    eyebrow: 'Prophylaxis',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 2 2',
    orientation: 'black',
    prompt: 'White has aimed queen and bishop at f7. Find candidate moves that answer the threat while improving Black.',
    predictionPrompt: "What is White's strongest reply to your favorite candidate?",
    coachCardId: 'prophylaxis',
    recommendedDepth: 11,
  },
  {
    id: 'blockade-passer',
    title: blockade.title,
    eyebrow: 'Endgame · Blockade',
    fen: blockade.body.fen,
    orientation: blockade.body.orientation,
    prompt: 'The d-pawn is one step from becoming dangerous. Compare stopping it, attacking it, and activating the king.',
    predictionPrompt: "If you do not blockade immediately, what forcing advance does Black gain?",
    coachCardId: 'blockade',
    recommendedDepth: 12,
  },
  {
    id: 'seize-open-file',
    title: openFile.title,
    eyebrow: 'Rook Activity',
    fen: openFile.body.fen,
    orientation: openFile.body.orientation,
    prompt: 'The d-file is clear. Propose rook moves and predict which entry square creates the most concrete pressure.',
    predictionPrompt: "Which pawn or rank becomes the rook's first target?",
    coachCardId: 'open-files',
    recommendedDepth: 12,
  },
  {
    id: 'attack-chain-base',
    title: attackChain.title,
    eyebrow: 'Pawn Structure',
    fen: attackChain.body.fen,
    orientation: attackChain.body.orientation,
    prompt: 'White has built a pawn chain. Compare attacking its head, its base, and developing quietly.',
    predictionPrompt: 'Which white recapture or advance must your candidate survive?',
    coachCardId: 'pawn-chains',
    recommendedDepth: 11,
  },
  {
    id: 'command-center',
    title: commandCenter.title,
    eyebrow: 'Center and Development',
    fen: commandCenter.body.fen,
    orientation: commandCenter.body.orientation,
    prompt: 'White owns a mobile center. Find candidates that gain space without forgetting development or tactics.',
    predictionPrompt: "After your pawn advance, which black piece is attacked and where can it go?",
    coachCardId: 'center-and-development',
    recommendedDepth: 11,
  },
  {
    id: 'spring-discovery',
    title: discovery.title,
    eyebrow: 'Forcing Calculation',
    fen: discovery.body.fen,
    orientation: discovery.body.orientation,
    prompt: 'The knight masks a rook attack. List forcing knight moves before calculating quieter ideas.',
    predictionPrompt: "Which discovered attack appears when the knight moves?",
    coachCardId: null,
    recommendedDepth: 10,
  },
];

export function getEngineXrayPosition(id) {
  return ENGINE_XRAY_POSITIONS.find((position) => position.id === id) ?? ENGINE_XRAY_POSITIONS[0];
}
