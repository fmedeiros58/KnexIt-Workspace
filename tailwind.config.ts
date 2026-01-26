import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./supadrive/**/*.{js,ts,jsx,tsx}",   // âœ… ADICIONE
    "./knexchat/**/*.{js,ts,jsx,tsx}",
    "./violive/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",         // âœ… opcional (bom se vocÃª usa src)
  ],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
    },
  },
  plugins: [],
} satisfies Config;

