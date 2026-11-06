module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // Last, so it also sees the comments tailwind's preflight brings in.
    "./postcss-drop-comments.js": {},
  },
};
