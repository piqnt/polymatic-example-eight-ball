import { render } from "preact";

import { App } from "./shell/App";

// the shell paints first and waits on the `runtime` signal; the lobby is loaded
// after, and fills that signal in when it is activated
render(<App />, document.getElementById("ui-root") as HTMLElement);

import("./async-loader");
