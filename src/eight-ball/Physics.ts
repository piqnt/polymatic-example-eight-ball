import { World, Circle, Polygon, type Vec2Value, Contact, Body, Settings } from "planck";
import { Binder, Driver, Middleware } from "polymatic";

import { Ball, Pocket, Rail, type BilliardContext } from "./BilliardContext";

export type Entity = Ball | Rail | Pocket;

// how balls roll and bounce, the computer plans its shots with these too
export const BALL_DAMPING = 1.5;
export const BALL_DENSITY = 1;
export const BALL_RESTITUTION = 0.99;

/**
 * Billiards physics simulation. This doesn't include any game rules, or table geometry.
 */
export class Physics extends Middleware<BilliardContext> {
  world: World;

  time: number = 0;
  timeStep = 1000 / 20;

  pocketedBalls: Ball[] = [];

  asleep = true;

  constructor() {
    super();
    this.on("activate", this.setup);
    this.on("frame-loop", this.handleFrameLoop);
    this.on("cue-shot", this.handleCueShot);
  }

  handleCueShot(data: { ball: Ball; shot: Vec2Value }) {
    if (this.context.shotInProgress || this.context.gameOver) return;
    const body = this.ballDriver.ref(data.ball.key);
    if (!body) return;
    this.asleep = false;
    body.applyLinearImpulse(data.shot, body.getPosition());
    this.context.shotInProgress = true;
    this.emit("shot-start", { ball: data.ball });
  }

  setup() {
    Settings.velocityThreshold = 0;
    this.world = new World();
    this.world.on("begin-contact", this.collide);
  }

  handleFrameLoop(ev: { dt: number }) {
    if (!this.context.balls || !this.context.rails || !this.context.pockets) return;
    this.binder.data([...this.context?.balls, ...this.context?.rails, , ...this.context?.pockets]);
    this.time += ev.dt;
    while (this.time >= this.timeStep) {
      this.time -= this.timeStep;
      if (this.asleep) continue;
      this.world.step(this.timeStep / 1000);
    }

    if (!this.asleep) {
      let asleep = true;
      for (let b = this.world.getBodyList(); b && asleep; b = b.getNext()) {
        if (!b.isStatic() && b.isAwake()) {
          asleep = false;
        }
      }
      this.asleep = asleep;
      if (this.asleep && this.context.shotInProgress) {
        this.endShot();
      }
    }
  }

  endShot() {
    if (!this.context.shotInProgress) return;
    this.context.shotInProgress = false;
    const pocketed = [...this.pocketedBalls];
    this.pocketedBalls.length = 0;
    this.emit("shot-end", { pocketed });
  }

  collide = (contact: Contact) => {
    const fA = contact.getFixtureA();
    const bA = fA.getBody();
    const fB = contact.getFixtureB();
    const bB = fB.getBody();

    const dataA = bA.getUserData() as Entity;
    const dataB = bB.getUserData() as Entity;

    if (!dataA || !dataB) return;

    const ball = dataA.type === "ball" ? dataA : dataB.type === "ball" ? dataB : null;
    const pocket = dataA.type === "pocket" ? dataA : dataB.type === "pocket" ? dataB : null;

    if (pocket) {
      // do not apply any force to the ball
      contact.setEnabled(false);
    }

    if (ball && pocket) {
      // do not change world immediately
      this.pocketedBalls.push(ball);
      const index = this.context.balls.indexOf(ball);
      if (index >= 0) {
        this.context.balls.splice(index, 1);
      }
    }
  };

  ballDriver = Driver.create<Ball, Body>({
    filter: (data) => data.type === "ball",
    enter: (data) => {
      const body = this.world.createBody({
        type: "dynamic",
        bullet: true,
        position: data.position,
        linearDamping: BALL_DAMPING,
        angularDamping: 1,
        userData: data,
      });
      body.createFixture({
        shape: new Circle(data.radius),
        friction: 0.1,
        restitution: BALL_RESTITUTION,
        density: BALL_DENSITY,
        userData: data,
      });
      return body;
    },
    update: (data, body) => {
      const p = body.getPosition();
      // we only need three decimal position (millimeter) outside physics simulation
      data.position.x = ((p.x * 1000) | 0) / 1000;
      data.position.y = ((p.y * 1000) | 0) / 1000;
    },
    exit: (data, body) => {
      this.world.destroyBody(body);
    },
  });

  railDriver = Driver.create<Rail, Body>({
    filter: (data) => data.type === "rail",
    enter: (data) => {
      const body = this.world.createBody({
        type: "static",
        userData: data,
      });
      const fixture = body.createFixture({
        shape: new Polygon(data.vertices),
        friction: 0.1,
        restitution: 0.9,
        userData: data,
      });
      return body;
    },
    update: (data, body) => {},
    exit: (data, body) => {
      this.world.destroyBody(body);
    },
  });

  pocketDriver = Driver.create<Pocket, Body>({
    filter: (data) => data.type === "pocket",
    enter: (data) => {
      const body = this.world.createBody({
        type: "static",
        position: data.position,
        userData: data,
      });
      const fixture = body.createFixture({
        shape: new Circle(data.radius),
        userData: data,
      });
      return body;
    },
    update: (data, body) => {},
    exit: (data, body) => {
      this.world.destroyBody(body);
    },
  });

  binder = Binder.create<Entity>({
    key: (data) => data.key,
    drivers: [this.ballDriver, this.railDriver, this.pocketDriver],
  });
}
