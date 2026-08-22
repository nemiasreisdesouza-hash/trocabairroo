import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function ensureUploadDir(subDir: string) {
  const dir = path.join(UPLOAD_DIR, subDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function uploadImage(
  file: File,
  subDir: "avatars" | "ads",
  maxWidth = 800
): Promise<string> {
  const dir = await ensureUploadDir(subDir);
  const ext = "jpg";
  const filename = `${uuidv4()}.${ext}`;
  const filepath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());

  await sharp(buffer)
    .resize(maxWidth, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(filepath);

  return `/uploads/${subDir}/${filename}`;
}

export async function deleteImage(imageUrl: string) {
  try {
    const relativePath = imageUrl.replace("/uploads/", "");
    const filepath = path.join(UPLOAD_DIR, relativePath);
    const { unlink } = await import("fs/promises");
    await unlink(filepath);
  } catch {
    // File may not exist
  }
}
