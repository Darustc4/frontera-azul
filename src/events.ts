/**
 * La Frontera Azul - Event System (Observer Pattern)
 *
 * Lightweight typed event emitter following the game programming pattern:
 * subjects notify observers without coupling to them. Observers are plain
 * functions (closures), not class instances.
 *
 * Usage:
 *   const events = new GameEvents();
 *   const unsub = events.on('log', (msg, type) => console.log(msg));
 *   events.emit('log', 'Hello', 'info');
 *   unsub(); // stop listening
 */

import type { GameAction } from './python-executor';

/** All events the game system can emit, with their payload signatures. */
export interface GameEventMap {
  /** A log message was produced (message, type). */
  'log': [message: string, type: string];
  /** A step was replayed during animation. */
  'step': [];
  /** An action was executed during Python run (position may have changed). */
  'action': [action: GameAction];
  /** Execution started. */
  'execution:start': [];
  /** Execution ended (success flag, action count). */
  'execution:end': [success: boolean, actionCount: number];
  /** All objectives were satisfied mid-execution — request early stop. */
  'objectives:met': [];
}

type Listener<T extends unknown[]> = (...args: T) => void;

export class GameEvents {
  private listeners = new Map<string, Set<Listener<any>>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof GameEventMap>(event: K, fn: Listener<GameEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => { this.listeners.get(event)?.delete(fn); };
  }

  /** Emit an event, notifying all current observers synchronously. */
  emit<K extends keyof GameEventMap>(event: K, ...args: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      fn(...args);
    }
  }

  /** Remove all listeners (cleanup on unmount). */
  clear(): void {
    this.listeners.clear();
  }
}
