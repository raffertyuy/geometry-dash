import { createGameLoop } from './game/game-loop';

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  const startScreen = document.querySelector<HTMLElement>('#start-screen');
  const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay');
  const debugOverlay = document.querySelector<HTMLElement>('#debug-overlay');
  const score = document.querySelector<HTMLElement>('#score');
  const timer = document.querySelector<HTMLElement>('#timer');

  if (!canvas || !startScreen || !pauseOverlay || !debugOverlay || !score || !timer) {
    console.error('Game bootstrap: required DOM elements not found', {
      canvas,
      startScreen,
      pauseOverlay,
      debugOverlay,
      score,
      timer,
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
  });
}

bootstrap();
