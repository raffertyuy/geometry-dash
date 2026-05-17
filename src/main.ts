import { createGameLoop } from './game/game-loop';

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  const startScreen = document.querySelector<HTMLElement>('#start-screen');
  const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay');
  const debugOverlay = document.querySelector<HTMLElement>('#debug-overlay');
  const score = document.querySelector<HTMLElement>('#score');
  const timer = document.querySelector<HTMLElement>('#timer');
  const livesHud = document.querySelector<HTMLElement>('#lives-hud');
  const gameOverOverlay = document.querySelector<HTMLElement>('#game-over-overlay');
  const gameOverScore = document.querySelector<HTMLElement>('#game-over-score');
  const gameOverTimer = document.querySelector<HTMLElement>('#game-over-timer');
  const problemModal = document.querySelector<HTMLElement>('#problem-modal');
  const floatingScores = document.querySelector<HTMLElement>('#floating-scores');
  const creditsOverlay = document.querySelector<HTMLElement>('#credits-overlay');
  const creditsLinkStart = document.querySelector<HTMLElement>('#credits-link-start');
  const creditsLinkGameOver = document.querySelector<HTMLElement>('#credits-link-game-over');

  if (
    !canvas ||
    !startScreen ||
    !pauseOverlay ||
    !debugOverlay ||
    !score ||
    !timer ||
    !livesHud ||
    !gameOverOverlay ||
    !gameOverScore ||
    !gameOverTimer ||
    !problemModal ||
    !floatingScores ||
    !creditsOverlay ||
    !creditsLinkStart ||
    !creditsLinkGameOver
  ) {
    console.error('Game bootstrap: required DOM elements not found', {
      canvas,
      startScreen,
      pauseOverlay,
      debugOverlay,
      score,
      timer,
      livesHud,
      gameOverOverlay,
      gameOverScore,
      gameOverTimer,
      problemModal,
      floatingScores,
      creditsOverlay,
      creditsLinkStart,
      creditsLinkGameOver,
    });
    return;
  }

  createGameLoop({
    canvas,
    startScreen,
    pauseOverlay,
    debugOverlay,
    score,
    timer,
    livesHud,
    gameOverOverlay,
    gameOverScore,
    gameOverTimer,
    problemModal,
    floatingScores,
    creditsOverlay,
    creditsLinkStart,
    creditsLinkGameOver,
  });
}

bootstrap();
