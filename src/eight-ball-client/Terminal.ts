import { Container, Graphics, Sprite, type FederatedPointerEvent, type Texture } from "pixi.js";
import { Binder, Driver, Memo, Middleware } from "polymatic";

import { CueStick, Ball, Pocket, Rail, Table, type Point } from "../eight-ball/BilliardContext";
import { type ClientBilliardContext } from "./ClientContext";
import { type FrameLoopEvent } from "./FrameLoop";
import { RollingBall } from "./RollingBall";
import {
  CUE_LENGTH,
  CUE_WIDTH,
  FRAME_WIDTH,
  TABLE_RESOLUTION,
  makeCueTexture,
  makePocketTexture,
  makeShadowTexture,
  makeShineTexture,
  makeTableTexture,
} from "./Textures";

// room around the table and its frame, as a part of their size
const VIEW_MARGIN = 1.06;
// pixi picks a circle's segment count from its radius in local units, which is tiny in meters,
// so circles are drawn larger and the graphics scaled back down
const CURVE_SCALE = 1000;
// shadows fall away from the lamp, down and right on screen, as a part of the ball radius
const SHADOW_OFFSET = { x: 0.25, y: 0.35 };
// how quickly shown positions catch up with the game's, in ms
const SMOOTHING = 40;
// gap between the cue tip and the ball, and how far it pulls back per meter of drag
const CUE_GAP = 0.01;
const CUE_PULL = 0.25;
const CUE_MAX_PULL = 0.2;

const CUSHION_COLOR = 0x1a6640;
const CUSHION_EDGE = 0x3a9a66;

interface BallView {
  shadow: Sprite;
  body: Sprite;
  light: Sprite;
  // its texture, turned as the ball rolls
  ball: RollingBall;
}

/**
 * Implements rendering and collecting user-input, with Pixi.
 */
export class Terminal extends Middleware<ClientBilliardContext> {
  // table, cushions and pockets, below shadows, balls and the cue
  tableLayer: Container;
  shadowLayer: Container;
  ballLayer: Container;
  cueLayer: Container;

  aim: Graphics;
  cueSprite: Sprite;

  // shared, the table texture is owned by its view, and each ball's by the ball
  shineTexture: Texture;
  shadowTexture: Texture;
  pocketTexture: Texture;
  cueTexture: Texture;

  dt = 0;

  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("frame-loop", this.handleFrameLoop);
  }

  handleActivate = () => {
    const pixi = this.context.pixi;

    this.shineTexture = makeShineTexture();
    this.shadowTexture = makeShadowTexture();
    this.pocketTexture = makePocketTexture();
    this.cueTexture = makeCueTexture();

    this.tableLayer = new Container();
    this.shadowLayer = new Container();
    this.ballLayer = new Container();
    this.cueLayer = new Container();
    this.aim = new Graphics();
    this.aim.scale.set(1 / CURVE_SCALE);
    this.cueSprite = new Sprite({ texture: this.cueTexture, anchor: { x: 0, y: 0.5 } });
    this.cueSprite.visible = false;
    this.cueLayer.addChild(this.aim, this.cueSprite);
    this.context.scene.addChild(this.tableLayer, this.shadowLayer, this.ballLayer, this.cueLayer);

    pixi.renderer.on("resize", this.handleViewport);
    this.handleViewport();

    pixi.stage.eventMode = "static";
    pixi.stage.hitArea = pixi.screen;
    pixi.stage.on("pointerdown", this.handlePointerDown);
    pixi.stage.on("globalpointermove", this.handlePointerMove);
    pixi.stage.on("pointerup", this.handlePointerUp);
    pixi.stage.on("pointerupoutside", this.handlePointerUp);
  };

  handleDeactivate = () => {
    const pixi = this.context.pixi;
    pixi?.renderer.off("resize", this.handleViewport);
    pixi?.stage.removeAllListeners();

    for (const texture of [this.shineTexture, this.shadowTexture, this.pocketTexture, this.cueTexture]) {
      texture?.destroy(true);
    }
  };

  viewportMemo = Memo.init();
  /**
   * Fit the table inside the screen, and center the origin. On a portrait screen the table is turned a quarter, so it
   * stays the long way round.
   */
  handleViewport = () => {
    const pixi = this.context.pixi;
    const table = this.context.table;
    if (!pixi || !table) return;

    const screenWidth = pixi.screen.width;
    const screenHeight = pixi.screen.height;
    if (!this.viewportMemo.update(table.width, table.height, screenWidth, screenHeight)) return;

    const frame = 2 * (table.pocketRadius * 1.5 + FRAME_WIDTH);
    const width = (table.width + frame) * VIEW_MARGIN;
    const height = (table.height + frame) * VIEW_MARGIN;
    const portrait = screenWidth < screenHeight;
    const viewWidth = portrait ? height : width;
    const viewHeight = portrait ? width : height;

    const scene = this.context.scene;
    const scale = Math.min(screenWidth / viewWidth, screenHeight / viewHeight);
    scene.scale.set(scale);
    scene.rotation = portrait ? -Math.PI / 2 : 0;
    scene.position.set(screenWidth / 2, screenHeight / 2);
  };

  toTable(ev: FederatedPointerEvent): Point {
    const p = this.context.scene.toLocal(ev.global);
    return { x: p.x, y: p.y };
  }

  pointerDown = false;

  handlePointerDown = (ev: FederatedPointerEvent) => {
    this.pointerDown = true;
    this.emit("user-pointer-start", this.toTable(ev));
  };

  handlePointerMove = (ev: FederatedPointerEvent) => {
    if (!this.pointerDown) return;
    this.emit("user-pointer-move", this.toTable(ev));
  };

  handlePointerUp = (ev: FederatedPointerEvent) => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    this.emit("user-pointer-end", this.toTable(ev));
  };

  handleFrameLoop = (ev: FrameLoopEvent) => {
    const { table, rails, pockets, balls, cue } = this.context;
    if (!table || !balls || !rails || !pockets) return;
    this.dt = ev.dt;

    this.binder.setData([table, ...rails, ...pockets, ...balls]);
    this.drawCue(cue);
  };

  /** The stick behind the cue ball, pulled back with the drag, and a dotted line the ball will take. */
  drawCue(cue: CueStick | null | undefined) {
    this.aim.clear();
    const ball = cue?.ball;
    const dx = cue ? cue.end.x - cue.start.x : 0;
    const dy = cue ? cue.end.y - cue.start.y : 0;
    const length = Math.hypot(dx, dy);
    if (!cue || !ball || length < 1e-6) {
      this.cueSprite.visible = false;
      return;
    }
    const ux = dx / length;
    const uy = dy / length;
    const r = ball.radius;

    // aim, from the ball edge the way it will go
    const k = CURVE_SCALE;
    const dot = r * 0.35;
    for (let t = r * 2; t < length; t += r * 1.5) {
      this.aim.circle((cue.start.x + ux * t) * k, (cue.start.y + uy * t) * k, dot * (1 - (t / length) * 0.6) * k);
    }
    this.aim.fill({ color: 0xffffff, alpha: 0.55 });

    // stick, on the other side of the ball
    const pull = Math.min(CUE_MAX_PULL, (length / 1.5) * CUE_PULL);
    const gap = r + CUE_GAP + pull;
    this.cueSprite.visible = true;
    this.cueSprite.position.set(cue.start.x - ux * gap, cue.start.y - uy * gap);
    this.cueSprite.rotation = Math.atan2(-uy, -ux);
    this.cueSprite.scale.set(CUE_LENGTH / this.cueTexture.width, CUE_WIDTH / this.cueTexture.height);
  }

  tableDriver = Driver.create<Table, Sprite>({
    filter: (data) => data.type == "table",
    enter: (data) => {
      const table = makeTableTexture(data);
      const sprite = new Sprite(table.texture);
      sprite.position.set(table.left, table.top);
      sprite.scale.set(1 / TABLE_RESOLUTION);
      this.tableLayer.addChildAt(sprite, 0);
      this.handleViewport();
      return sprite;
    },
    update: (data, sprite) => {},
    exit: (data, sprite) => {
      sprite.removeFromParent();
      sprite.destroy({ texture: true, textureSource: true });
    },
  });

  railDriver = Driver.create<Rail, Graphics>({
    filter: (data) => data.type == "rail",
    enter: (data) => {
      const [a, , , d] = data.vertices;
      // the cushion, and its nose along the playing edge, from the last vertex to the first, see PoolTable
      const graphics = new Graphics()
        .poly(data.vertices)
        .fill({ color: CUSHION_COLOR })
        .stroke({ width: 0.002, color: 0x0c3a22 })
        .moveTo(a.x, a.y)
        .lineTo(d.x, d.y)
        .stroke({ width: 0.004, color: CUSHION_EDGE, alpha: 0.9 });
      this.tableLayer.addChild(graphics);
      return graphics;
    },
    update: (data, graphics) => {},
    exit: (data, graphics) => {
      graphics.removeFromParent();
      graphics.destroy();
    },
  });

  pocketDriver = Driver.create<Pocket, Sprite>({
    filter: (data) => data.type == "pocket",
    enter: (data) => {
      const sprite = new Sprite({ texture: this.pocketTexture, anchor: 0.5 });
      sprite.position.set(data.position.x, data.position.y);
      sprite.scale.set((2 * data.radius * 1.12) / this.pocketTexture.width);
      this.tableLayer.addChild(sprite);
      return sprite;
    },
    update: (data, sprite) => {},
    exit: (data, sprite) => {
      sprite.removeFromParent();
      sprite.destroy();
    },
  });

  ballDriver = Driver.create<Ball, BallView>({
    filter: (data) => data.type == "ball",
    enter: (data) => {
      const ball = new RollingBall(data.color);
      const texture = ball.texture;
      const size = 2 * data.radius;
      const shadow = new Sprite({ texture: this.shadowTexture, anchor: 0.5 });
      shadow.scale.set((size * 1.1) / this.shadowTexture.width);
      const body = new Sprite({ texture, anchor: 0.5 });
      body.scale.set(size / texture.width);
      const light = new Sprite({ texture: this.shineTexture, anchor: 0.5 });
      light.scale.set(size / this.shineTexture.width);
      for (const sprite of [shadow, body, light]) sprite.position.set(data.position.x, data.position.y);
      this.shadowLayer.addChild(shadow);
      this.ballLayer.addChild(body, light);
      return { shadow, body, light, ball };
    },
    update: (data, view) => {
      // positions change a few times a second, in millimeter steps, and are eased toward
      const t = 1 - Math.exp(-this.dt / SMOOTHING);
      const x = view.body.x + (data.position.x - view.body.x) * t;
      const y = view.body.y + (data.position.y - view.body.y) * t;
      const r = data.radius;
      view.ball.roll(x - view.body.x, y - view.body.y, r);
      view.ball.update();
      // the light and the shadow stay put on screen when the table is turned
      const turn = -this.context.scene.rotation;
      const ox = SHADOW_OFFSET.x * r;
      const oy = SHADOW_OFFSET.y * r;
      view.body.position.set(x, y);
      view.light.position.set(x, y);
      view.light.rotation = turn;
      view.shadow.position.set(
        x + ox * Math.cos(turn) - oy * Math.sin(turn),
        y + ox * Math.sin(turn) + oy * Math.cos(turn),
      );
    },
    exit: (data, view) => {
      for (const sprite of [view.shadow, view.body, view.light]) {
        sprite.removeFromParent();
        sprite.destroy();
      }
      view.ball.destroy();
    },
  });

  binder = Binder.create<Ball | Rail | Pocket | Table>({
    key: (data) => data.key,
    drivers: [this.tableDriver, this.railDriver, this.pocketDriver, this.ballDriver],
  });
}
