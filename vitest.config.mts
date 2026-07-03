const config = {
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
};

export default config;
