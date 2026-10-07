import { useRuntime } from "./context";
import { closeNotice, declineRejoin, rejoinRoom } from "./actions";
import styles from "./Shell.module.css";

/** This browser was in a room that is still running, see LobbyClient. */
export function RejoinDialog() {
  const runtime = useRuntime();

  return (
    <div class={styles.backdrop} onClick={() => declineRejoin(runtime)}>
      <div
        class={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Rejoin room"
        onClick={(ev) => ev.stopPropagation()}
      >
        <span class={styles.dialogTitle}>Rejoin room {runtime.hud.rejoinRoom.value}?</span>
        <span>Your game there is still running.</span>
        <div class={styles.dialogActions}>
          <button type="button" class={styles.button} onClick={() => declineRejoin(runtime)}>
            Stay offline
          </button>
          <button type="button" class={styles.button} onClick={() => rejoinRoom(runtime)} autoFocus>
            Rejoin
          </button>
        </div>
      </div>
    </div>
  );
}

/** A one-time message, like a room the player was in having closed. */
export function NoticeDialog() {
  const runtime = useRuntime();

  return (
    <div class={styles.backdrop} onClick={() => closeNotice(runtime)}>
      <div
        class={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label="Notice"
        onClick={(ev) => ev.stopPropagation()}
      >
        <span>{runtime.hud.notice.value}</span>
        <div class={styles.dialogActions}>
          <button type="button" class={styles.button} onClick={() => closeNotice(runtime)} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
