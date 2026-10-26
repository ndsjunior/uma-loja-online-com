/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", ink: "var(--ink)", muted: "var(--muted)",
        line: "var(--line)", accent: "var(--accent)", "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)", sun: "var(--sun)", "sun-ink": "var(--sun-ink)",
      },
      fontFamily: { display: "var(--font-display)", body: "var(--font-body)" },
      fontSize: {
        display: ["clamp(2.75rem, 6vw + 1rem, 6rem)", { lineHeight: "1", letterSpacing: "-0.03em" }],
        h1: ["clamp(2.25rem, 4vw + 1rem, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h2: ["clamp(1.75rem, 2.5vw + 1rem, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        h3: ["clamp(1.25rem, 0.6vw + 1rem, 1.5rem)", { lineHeight: "1.25" }],
        lead: ["clamp(1.0625rem, 0.4vw + 1rem, 1.3125rem)", { lineHeight: "1.6" }],
      },
      borderRadius: { ui: "var(--radius)", "ui-lg": "calc(var(--radius) * 2)" },
      boxShadow: { ui: "var(--shadow)" },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
}
