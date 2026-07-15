import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");

async function optimizePoiImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await optimizePoiImages(filePath);
        return;
      }

      if (!entry.isFile() || !/\.jpe?g$/i.test(entry.name)) {
        return;
      }

      await sharp(filePath)
        .rotate()
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 72, effort: 5 })
        .toFile(filePath.replace(/\.jpe?g$/i, ".webp"));
    }),
  );
}

async function main() {
  const hero = sharp(path.join(publicDir, "home-great-wall.png")).rotate();
  await Promise.all([
    hero
      .clone()
      .resize({ width: 768, withoutEnlargement: true })
      .avif({ quality: 45, effort: 6 })
      .toFile(path.join(publicDir, "home-great-wall-768.avif")),
    hero
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .avif({ quality: 50, effort: 6 })
      .toFile(path.join(publicDir, "home-great-wall-1600.avif")),
    hero
      .clone()
      .resize({ width: 1200, height: 630, fit: "cover", position: "attention" })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(path.join(publicDir, "home-social.jpg")),
    sharp(path.join(publicDir, "logo-img.png"))
      .rotate()
      .resize(192, 192, { fit: "cover" })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(publicDir, "logo-192.webp")),
    sharp(path.join(publicDir, "logo-img.png"))
      .rotate()
      .resize(96, 96, { fit: "cover" })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(publicDir, "logo-96.webp")),
    sharp(path.join(publicDir, "logo-img.png"))
      .rotate()
      .resize(180, 180, { fit: "cover" })
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(root, "app", "apple-icon.png")),
    sharp(path.join(publicDir, "logo-img.png"))
      .rotate()
      .resize(64, 64, { fit: "cover" })
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(root, "app", "icon.png")),
  ]);

  await optimizePoiImages(path.join(publicDir, "answer-assets", "poi"));
}

await mkdir(path.join(root, "app"), { recursive: true });
await main();
