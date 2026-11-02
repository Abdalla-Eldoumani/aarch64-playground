// next starts a new stylesheet once one passes 102,400 chars of unminified CSS,
// comments counted; the minifier drops these anyway and keeps `/*!` licences.
module.exports = () => ({
  postcssPlugin: "drop-comments",
  OnceExit(root) {
    root.walkComments((comment) => {
      if (!comment.text.startsWith("!")) comment.remove();
    });
  },
});
module.exports.postcss = true;
