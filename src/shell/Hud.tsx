import { TbDoorEnter, TbPlayerPlay, TbPlus, TbRobot } from "react-icons/tb";

import { useRuntime } from "./context";
import { createRoom, openJoin, playComputer, playOffline } from "./actions";
import { JoinDialog } from "./JoinDialog";
import { NoticeDialog, RejoinDialog } from "./RoomDialogs";
import styles from "./Shell.module.css";

/** The status lines above the table, and the lobby controls below it. */
export function Hud() {
  const runtime = useRuntime();
  const { joinOpen, rejoinRoom, notice } = runtime.hud;

  return (
    <>
      <Status />
      <Controls />
      {joinOpen.value && <JoinDialog />}
      {rejoinRoom.value && <RejoinDialog />}
      {notice.value && !rejoinRoom.value && <NoticeDialog />}
    </>
  );
}

function Status() {
  const { room, statusText, roomError } = useRuntime().hud;

  return (
    <div class={styles.status}>
      {room.value && (
        <span class={`${styles.line} ${styles.room}`} aria-label="Room id">
          {room.value}
        </span>
      )}
      {statusText.value && !roomError.value && <span class={styles.line}>{statusText.value}</span>}
      {roomError.value && <span class={`${styles.line} ${styles.error}`}>{roomError.value}</span>}
    </div>
  );
}

function Controls() {
  const runtime = useRuntime();

  return (
    <div class={styles.controls}>
      <button type="button" class={styles.button} onClick={() => playComputer(runtime)}>
        <TbRobot aria-hidden size="1em" /> Play Computer
      </button>
      <button type="button" class={styles.button} onClick={() => playOffline(runtime)}>
        <TbPlayerPlay aria-hidden size="1em" /> Practice
      </button>
      <button type="button" class={styles.button} onClick={() => createRoom(runtime)}>
        <TbPlus aria-hidden size="1em" /> Create Room
      </button>
      <button type="button" class={styles.button} onClick={() => openJoin(runtime)}>
        <TbDoorEnter aria-hidden size="1em" /> Join Room
      </button>
    </div>
  );
}
