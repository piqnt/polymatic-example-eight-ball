import { useState } from "preact/hooks";

import { useRuntime } from "./context";
import { closeJoin, joinRoom } from "./actions";
import styles from "./Shell.module.css";

/**
 * Asking for a room id. This used to be window.prompt, with window.alert for a
 * bad id; the id is checked by the lobby either way, and what it says comes
 * back on `hud.joinError`.
 */
export function JoinDialog() {
  const runtime = useRuntime();
  const [id, setId] = useState("");
  const error = runtime.hud.joinError.value;

  const submit = (ev: Event) => {
    ev.preventDefault();
    joinRoom(runtime, id);
  };

  return (
    <div class={styles.backdrop} onClick={() => closeJoin(runtime)}>
      <form
        class={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Join room"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={submit}
      >
        <span class={styles.dialogTitle}>Join room</span>
        <input
          class={styles.input}
          value={id}
          placeholder="xxx-xxx-xxx"
          aria-label="Room id"
          autoFocus
          onInput={(ev) => setId((ev.target as HTMLInputElement).value)}
        />
        {error && <span class={styles.dialogError}>{error}</span>}
        <div class={styles.dialogActions}>
          <button type="button" class={styles.button} onClick={() => closeJoin(runtime)}>
            Cancel
          </button>
          <button type="submit" class={styles.button}>
            Join
          </button>
        </div>
      </form>
    </div>
  );
}
