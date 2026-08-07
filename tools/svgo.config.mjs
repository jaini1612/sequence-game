export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // The symbols in here are referenced from the app, not from within this file, so the
          // "unused" passes would delete the entire sprite.
          removeHiddenElems: false,
          removeUselessDefs: false,
          cleanupIds: false,
          removeViewBox: false,
          removeUnknownsAndDefaults: { keepAriaAttrs: true },
        },
      },
    },
  ],
};
