import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050505",
        panel: "#0b0b0b",
        panelSoft: "#101010",
        line: "#1d1d1d",
        accent: "#23c552",
        accentSoft: "#1b7f3a"
      }
    }
  },
  plugins: []
};

export default config;

