/** Functions the desktop shell exposes to the page as `bindings.<name>()`. */
export interface DesktopBindings {
  launchToken(): Promise<string>;
}
