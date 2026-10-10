// Harness hook behind Fathom.UI.Components.appearance_control/1.
// Appearance is browser-local, so the page owns it, not a plugin process.
export const FathomAppearance = {
  mounted() {
    const preference = this.el.dataset.preference
    const appearance = window.fathomAppearance

    if (preference === "theme") {
      this.el.value = appearance.theme()
      this.el.addEventListener("change", () => appearance.setTheme(this.el.value))
    } else {
      this.el.checked = appearance.motion() === "reduce"
      this.el.addEventListener("change", () => appearance.setMotion(this.el.checked ? "reduce" : "system"))
    }
  }
}
