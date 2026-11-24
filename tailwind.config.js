/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#173F35",
        "forest-light": "#173F35",
        sand: "#F5F0E6",
        paper: "#F5F0E6",
        ink: "#49372D",
        gold: "#D6B77A",
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
