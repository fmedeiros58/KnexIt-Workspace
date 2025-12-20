import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./supadrive/**/*.{js,ts,jsx,tsx}",   // ✅ ADICIONE
    "./src/**/*.{js,ts,jsx,tsx}",         // ✅ opcional (bom se você usa src)
  ],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
    },
  },
  plugins: [],
} satisfies Config;
