#!/usr/bin/env node
/**
 * Image Optimization Script
 * Converts JPG images to WebP format with quality settings
 * Reduces file sizes by ~70% while maintaining visual quality
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, '..', 'public');
const DEMO_DIR = join(PUBLIC_DIR, 'demo');
const OPTIMIZED_DIR = join(PUBLIC_DIR, 'optimized');

const WEBP_QUALITY = 85; // High quality for demo images
const WEBP_EFFORT = 6; // 0-6, higher = better compression but slower

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function optimizeImage(inputPath, outputPath) {
  try {
    const info = await sharp(inputPath)
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(outputPath);

    return info;
  } catch (err) {
    console.error(`Failed to optimize ${inputPath}:`, err.message);
    return null;
  }
}

async function getFileSize(path) {
  try {
    const stats = await stat(path);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function processDirectory(dir, outputDir) {
  const files = await readdir(dir);
  const results = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const inputPath = join(dir, file);
    const outputFile = basename(file, ext) + '.webp';
    const outputPath = join(outputDir, outputFile);

    const originalSize = await getFileSize(inputPath);

    console.log(`Optimizing ${file}...`);
    const info = await optimizeImage(inputPath, outputPath);

    if (info) {
      const newSize = info.size;
      const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

      results.push({
        file,
        originalSize,
        newSize,
        savings: parseFloat(savings)
      });

      console.log(`  ✓ ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${savings}% savings)`);
    }
  }

  return results;
}

async function main() {
  console.log('🖼️  Image Optimization Script\n');

  // Create optimized directory
  await ensureDir(OPTIMIZED_DIR);

  // Process public directory JPGs
  console.log('📁 Processing public/*.jpg files...\n');
  const publicResults = await processDirectory(PUBLIC_DIR, OPTIMIZED_DIR);

  // Process demo directory PNGs
  console.log('\n📁 Processing public/demo/*.png files...\n');
  const demoOutputDir = join(OPTIMIZED_DIR, 'demo');
  await ensureDir(demoOutputDir);
  const demoResults = await processDirectory(DEMO_DIR, demoOutputDir);

  // Summary
  const allResults = [...publicResults, ...demoResults];
  if (allResults.length > 0) {
    const totalOriginal = allResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = allResults.reduce((sum, r) => sum + r.newSize, 0);
    const totalSavings = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);

    console.log('\n✨ Summary:');
    console.log(`  Files optimized: ${allResults.length}`);
    console.log(`  Total original: ${formatBytes(totalOriginal)}`);
    console.log(`  Total optimized: ${formatBytes(totalNew)}`);
    console.log(`  Total savings: ${totalSavings}%`);
    console.log(`\n  Output directory: ${OPTIMIZED_DIR}`);
  } else {
    console.log('No images found to optimize.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
