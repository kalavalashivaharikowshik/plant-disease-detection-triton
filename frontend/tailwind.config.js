/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Herbarium palette: specimen paper, pressed-leaf greens, turmeric for attention.
        paper: "#f3f5ef",
        sheet: "#fbfcf8",
        mist: "#dce3d8",
        ink: "#183a2c",
        body: "#33413a",
        moss: "#4f7a5a",
        turmeric: "#e2a229",
        "turmeric-soft": "#fbefd4",
        rust: "#b23a26",
        "rust-soft": "#f6e1dc",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
      },
      fontSize: {
        // Modular scale (1.25) on a 17px base for outdoor readability.
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["1.0625rem", { lineHeight: "1.65rem" }],
        lg: ["1.25rem", { lineHeight: "1.8rem" }],
        xl: ["1.5625rem", { lineHeight: "2rem" }],
        "2xl": ["1.953rem", { lineHeight: "2.3rem" }],
        "3xl": ["2.441rem", { lineHeight: "2.7rem" }],
        "4xl": ["3.052rem", { lineHeight: "3.2rem" }],
      },
      maxWidth: { prose: "68ch" },
      keyframes: {
        sweep: { "0%": { top: "0%" }, "100%": { top: "100%" } },
        reveal: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        sweep: "sweep 1.6s ease-in-out infinite alternate",
        reveal: "reveal 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
