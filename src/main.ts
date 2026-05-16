import { createGameLoop } from './game/game-loop';

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  const startScreen = document.querySelector<HTMLElement>('#start-screen');
  const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay');
  const debugOverlay = document.querySelector<HTMLElement>('#debug-overlay');

  if (!canvas || !startScreen || !pauseOverlay || !debugOverlay) {
    console.error('Game bootstrap: required DOM elements not found', {
      canvas,
      startScreen,
      pauseOverlay,
      debugOverlay,
    });
    return;
  }

  createGameLoop({ canvas, startScreen, pauseOverlay, debugOverlay });
}

bootstrap();
