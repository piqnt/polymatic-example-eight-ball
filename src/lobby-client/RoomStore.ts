import { nanoid } from "nanoid";

import { type Auth } from "../eight-ball-client/ClientContext";

/**
 * What the browser remembers about online rooms, so a player can get back into a game.
 *
 * - The room this tab is in, per tab, so a reload goes straight back in.
 * - The last room this browser played in and when, so a closed tab can offer to rejoin it.
 * - The logins used in each room. A tab holds a lock on the login it uses, so a tab that opens the same room takes a
 *   login nobody is using: after a tab was closed that is its login and seat, while a second open tab gets a new one
 *   and can play the first.
 */

const PREFIX = "eight-ball";
const TAB_ROOM = PREFIX + "-room";
const TAB_AUTH = PREFIX + "-auth";
const LAST_ROOM = PREFIX + "-last-room";
const AUTHS = PREFIX + "-auths";

// logins for a room not played in this long are dropped, in ms
const AUTH_EXPIRE = 24 * 60 * 60 * 1000;

export interface LastRoom {
  id: string;
  // when this browser was last in the room, in ms
  time: number;
}

type SavedAuths = Record<string, { time: number; auths: Auth[] }>;

function read<T>(storage: Storage, key: string): T | null {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage is full or blocked, the player just can not rejoin
  }
}

export const getTabRoom = () => read<string>(sessionStorage, TAB_ROOM);

export const getLastRoom = () => read<LastRoom>(localStorage, LAST_ROOM);

/** This tab is in the room now, called when it opens the room and every so often while it plays. */
export function touchRoom(id: string) {
  const time = Date.now();
  write(sessionStorage, TAB_ROOM, id);
  write(localStorage, LAST_ROOM, { id, time });
  const saved = readAuths();
  if (saved[id]) {
    saved[id].time = time;
    write(localStorage, AUTHS, saved);
  }
}

/** The player left online play, a new tab should not offer the room again. Their logins are kept. */
export function leaveRoom() {
  write(sessionStorage, TAB_ROOM, null);
  write(localStorage, LAST_ROOM, null);
}

/** The server has no such room, nothing about it is worth keeping. */
export function forgetRoom(id: string) {
  if (getTabRoom() === id) write(sessionStorage, TAB_ROOM, null);
  if (getLastRoom()?.id === id) write(localStorage, LAST_ROOM, null);
  const saved = readAuths();
  delete saved[id];
  write(localStorage, AUTHS, saved);
}

function readAuths(): SavedAuths {
  const saved = read<SavedAuths>(localStorage, AUTHS) ?? {};
  const now = Date.now();
  for (const id of Object.keys(saved)) {
    if (!(now - saved[id]?.time < AUTH_EXPIRE)) delete saved[id];
  }
  return saved;
}

export interface HeldAuth {
  auth: Auth;
  // lets another tab take this login
  release: () => void;
}

/**
 * A login for the room that no other tab is using: this tab's own after a reload, else one a closed tab left, else a
 * new one.
 */
export async function acquireAuth(room: string): Promise<HeldAuth> {
  const saved = readAuths();
  const auths = saved[room]?.auths ?? [];
  const mine = read<Auth & { room: string }>(sessionStorage, TAB_AUTH);
  const candidates = mine?.room === room ? [mine, ...auths.filter((a) => a.id !== mine.id)] : auths;

  for (const auth of candidates) {
    const release = await tryLock(auth.id);
    if (release) return hold(room, { id: auth.id, secret: auth.secret }, release);
  }

  // id is public and will be shared by other users, secret is private
  const auth = { id: "player-" + nanoid(8), secret: "secret-" + nanoid(8) };
  const latest = readAuths();
  latest[room] = { time: Date.now(), auths: [...(latest[room]?.auths ?? []), auth] };
  write(localStorage, AUTHS, latest);
  return hold(room, auth, (await tryLock(auth.id)) ?? (() => {}));
}

function hold(room: string, auth: Auth, release: () => void): HeldAuth {
  write(sessionStorage, TAB_AUTH, { room, ...auth });
  return { auth, release };
}

/**
 * Takes the lock named after the login if no other tab holds it, and keeps it until released or the tab is gone.
 * Without the locks api every tab counts as free, so a second tab would share the first one's login.
 */
function tryLock(id: string): Promise<(() => void) | null> {
  if (!navigator.locks) return Promise.resolve(() => {});
  return new Promise((resolve) => {
    navigator.locks
      .request(PREFIX + "-auth-" + id, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        return new Promise<void>((release) => resolve(release));
      })
      .catch(() => resolve(null));
  });
}
