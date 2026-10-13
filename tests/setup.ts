import { GameState } from '../src/core/GameState';

// Sezóny sa riadia skutočným dátumom – testy bežia vždy v „obyčajný" deň mimo sezóny.
GameState.today = () => new Date(2026, 5, 15);
