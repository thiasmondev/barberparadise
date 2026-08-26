const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dopr7tgf8";
const CLOUDINARY_UPLOAD_PRESET = "barberparadise_unsigned";
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadImageToCloudinary(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Seules les images sont acceptées (JPG, PNG, WebP, GIF)");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("L'image ne doit pas dépasser 10 MB");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur Cloudinary (${response.status})`);
  }

  const data = await response.json() as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary n’a renvoyé aucune URL d’image");
  return data.secure_url;
}

export function uploadProductImageToCloudinary(file: File): Promise<string> {
  return uploadImageToCloudinary(file, "barberparadise/products");
}

export function uploadBlogCoverToCloudinary(file: File): Promise<string> {
  return uploadImageToCloudinary(file, "barberparadise/blog");
}
