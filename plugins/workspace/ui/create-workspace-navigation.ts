import { createSignal, onCleanup } from "solid-js";

interface Route {
  area: "workspace" | "settings";
  id?: string;
}

export function createWorkspaceNavigation() {
  const read = (): Route => {
    const [area, ...parts] = location.hash.slice(2).split("/");

    return {
      area: area === "settings" ? "settings" : "workspace",
      id: parts.join("/") || undefined,
    };
  };

  const initial = read();
  const [route, setRoute] = createSignal(initial);
  let previousPage = initial.area === "workspace" ? initial.id : undefined;

  const update = () => {
    const next = read();
    setRoute(next);

    if (next.area === "workspace") {
      previousPage = next.id;
    }
  };

  addEventListener("hashchange", update);
  onCleanup(() => removeEventListener("hashchange", update));

  const navigate = (area: Route["area"], id?: string) => {
    location.hash = `/${area}${id ? `/${id}` : ""}`;
  };

  return {
    route,
    workspace: () => navigate("workspace", previousPage),
    page: (id: string) => navigate("workspace", id),
    settings: (id = "workspace/general") => navigate("settings", id),
  };
}
