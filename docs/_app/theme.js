tailwind.config = {
  theme: {
    extend: {
      colors: {
        canvas: "#fafafa",
        panel: "#ffffff",
        ink: "#0f0f10",
        mute: "#6b6f76",
        faint: "#9b9ea5",
        line: "#e6e6e6",
        soft: "#f3f3f4",
        accent: "#5e6ad2",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: { measure: "52rem" },
      borderRadius: {
        none: "0",
        DEFAULT: "0",
        sm: "0",
        md: "0",
        lg: "0",
        full: "0",
      },
    },
  },
};
