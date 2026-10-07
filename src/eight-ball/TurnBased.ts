import { Middleware } from "polymatic";

export interface Turn {
  turns: string[];
  current?: string;
}

export interface TurnPlayer {
  id: string;
  turn?: string;
}

export interface TurnBasedContext {
  turn?: Turn;
  players?: TurnPlayer[];
}

export class TurnBased extends Middleware<TurnBasedContext> {
  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("pass-turn", this.handlePassTurn);
    this.on("game-start", this.handleInitGame);
  }

  handleActivate = () => {
    this.context.turn = { turns: ["turn-one", "turn-two"] };
  };

  handleDeactivate = () => {};

  handlePassTurn() {
    const turn = this.context.turn;
    const currentIndex = turn.turns.indexOf(turn.current);
    const nextIndex = (currentIndex + 1) % turn.turns.length;
    turn.current = turn.turns[nextIndex];
  }

  handleInitGame = () => {
    const turns = this.context.turn.turns;
    this.context.turn.current = turns[0];
    const players = this.context.players.sort(() => Math.random() - 0.5);
    for (let i = 0; i < turns.length; i++) {
      players[i].turn = turns[i];
    }
  };
}
