// Drop library console.error at bundle time (AGENTS.md: never edit library source).
// Vite 8 bundles with Rolldown: treeshake.manualPureFunctions (esbuild.pure is ignored there).
export default {
  base: './',
  build: { rolldownOptions: { treeshake: { manualPureFunctions: ['console.error'] } } },
};
