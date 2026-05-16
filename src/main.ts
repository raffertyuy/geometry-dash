import { createGameLoop } from './game/game-loop';

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  const startScreen = document.querySelector<HTMLElement>('#start-screen');
  const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay');
  const debugOverlay = document.querySelector<HTMLElement>('#debug-overlay');
  const score = document.querySelector<HTMLElement>('#score');
  const timer = document.querySelector<HTMLElement>('#timer');
  const gameOverOverlay = document.querySelector<HTMLElement>('#game-over-overlay');
  const gameOverScore = document.querySelector<HTMLElement>('#game-over-score');
  const gameOverTimer = document.querySelector<HTMLElement>('#game-over-timer');

  if (
    !canvas ||
    !startScreen ||
    !pauseOverlay ||
    !debugOverlay ||
    !score ||
    !timer ||
    !gameOverOverlay ||
    !gameOverScore ||
    !gameOverTimer
  ) {
    console.error('Game bootstrap: required DOM elements not found', {
      canvas,
      startScreen,
      pauseOverlay,
      debugOverlay,
      score,
      timer,
      gameOverOverlay,
      gameOverScore,
      gameOverTimer,
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
    gameOverOverlay,
    gameOverScore,
    gameOverTimer,
  });
}

bootstrap();
