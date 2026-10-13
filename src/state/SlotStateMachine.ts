export type SlotState =
  | 'Boot'
  | 'Idle'
  | 'Spinning'
  | 'Stopping'
  | 'Evaluating'
  | 'WinPresentation'
  | 'FreeSpins'
  | 'HoldAndWin'
  | 'Error';

/** Every legal transition. Anything else is a bug and throws. */
const NEXT: Record<SlotState, readonly SlotState[]> = {
  Boot: ['Idle', 'Evaluating'], // Evaluating = resume an unfinished round
  Idle: ['Spinning'],
  Spinning: ['Stopping', 'Error'],
  Error: ['Spinning', 'Idle'], // retry, or give up on a dropped request
  Stopping: ['Evaluating'],
  Evaluating: ['WinPresentation', 'FreeSpins', 'HoldAndWin', 'Idle'],
  WinPresentation: ['FreeSpins', 'HoldAndWin', 'Idle'],
  FreeSpins: ['WinPresentation'],
  HoldAndWin: ['WinPresentation'],
};

type Listener = (from: SlotState, to: SlotState) => void;

/** Single source of truth for round flow. */
export class SlotStateMachine {
  state: SlotState = 'Boot';
  private listeners: Listener[] = [];

  on(fn: Listener) {
    this.listeners.push(fn);
  }

  can(to: SlotState) {
    return NEXT[this.state].includes(to);
  }

  to(next: SlotState) {
    if (!this.can(next)) throw new Error(`illegal transition ${this.state} -> ${next}`);
    const from = this.state;
    this.state = next;
    for (let i = 0; i < this.listeners.length; i++) this.listeners[i](from, next);
  }
}
