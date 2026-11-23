
import type { ReflectionLimits } from "../api/client";

export const DEFAULT_REFLECTION_LIMITS: ReflectionLimits = {
  maxImages: 3,
  maxImageBytes: 1_048_576,
  maxTextCharacters: 5_000,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  requestBodyBytes: 5_242_880,
};

export async function prepareReflectionPhoto(
  file: File,
  limits: ReflectionLimits = DEFAULT_REFLECTION_LIMITS,
): Promise<string> {
  if (!limits.acceptedMimeTypes.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Choose a photo smaller than 20 MB.");
  }

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    if (!image.naturalWidth || !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("This photo is too large. Choose a smaller version.");
    }

    if (file.size <= limits.maxImageBytes) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Couldn't read this photo."));
        reader.onerror = () => reject(new Error("Couldn't read this photo."));
        reader.readAsDataURL(file);
      });
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Couldn't prepare this photo. Try a smaller file.");
    }

    for (const edge of [1600, 1200, 900]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const data = canvas.toDataURL("image/webp", 0.82);

      if (atob(data.slice(data.indexOf(",") + 1)).length <= limits.maxImageBytes) {
        return data;
      }
    }

    throw new Error("This photo is still too large. Choose a smaller version.");
  } catch (error) {
    if (error instanceof DOMException) {
      throw new Error("Couldn't open this photo. Choose a valid JPEG, PNG, or WebP file.");
    }
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
