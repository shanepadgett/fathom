const params = new URLSearchParams(location.search);

if (params.has("screen") || params.has("preview")) {
  const { renderStandalonePreview } = await import(
    "./site/standalone-preview.ts"
  );
  renderStandalonePreview(params);
} else {
  await import("./site/design-app.ts");
}
