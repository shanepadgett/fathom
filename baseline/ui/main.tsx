/// <reference path="./elements.d.ts" />
import { render } from "solid-js/web";

import { App } from "./app.tsx";
import "./styles.css";

document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
render(() => <App />, root);
