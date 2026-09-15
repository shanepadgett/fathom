async function pngImage(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the image to copy.");
  const source = await response.blob();
  if (source.type === "image/png") return source;
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width * bitmap.height > 32_000_000) {
      throw new Error(
        "This image is too large to copy. Download the original instead.",
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image copying is unavailable.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not prepare the image to copy.")),
        "image/png",
      );
    });
  } finally {
    bitmap.close();
  }
}

export async function copyImage(url: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error(
      "Image copying is unavailable. Download the image instead.",
    );
  }
  const image = pngImage(url);
  // Keep the write inside the click's activation while the image is prepared.
  void image.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
}
