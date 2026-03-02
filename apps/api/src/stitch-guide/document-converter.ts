import { pdf } from "pdf-to-img";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { SupportedMediaType } from "./schemas.js";
import { imageMediaTypes } from "./schemas.js";

const execFileAsync = promisify(execFile);

type ImageOutput = {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

export class DocumentConverter {
  static readonly MAX_PAGES = 5;

  async toImages(
    base64Data: string,
    mediaType: SupportedMediaType
  ): Promise<ImageOutput[]> {
    if ((imageMediaTypes as readonly string[]).includes(mediaType)) {
      return [
        {
          data: base64Data,
          mediaType: mediaType as ImageOutput["mediaType"],
        },
      ];
    }

    if (mediaType === "application/pdf") {
      return this.pdfToImages(base64Data);
    }

    // Office documents: convert to PDF first, then to images
    return this.officeToImages(base64Data, mediaType);
  }

  private async pdfToImages(base64Data: string): Promise<ImageOutput[]> {
    const buffer = Buffer.from(base64Data, "base64");
    const images: ImageOutput[] = [];
    let pageCount = 0;

    for await (const page of await pdf(buffer, { scale: 2 })) {
      if (pageCount >= DocumentConverter.MAX_PAGES) break;
      images.push({
        data: Buffer.from(page).toString("base64"),
        mediaType: "image/png",
      });
      pageCount++;
    }

    return images;
  }

  private async officeToImages(
    base64Data: string,
    _mediaType: SupportedMediaType
  ): Promise<ImageOutput[]> {
    const tmpDir = await mkdtemp(join(tmpdir(), "stitch-guide-"));
    const inputPath = join(tmpDir, "input");
    const outputPath = join(tmpDir, "input.pdf");

    try {
      await writeFile(inputPath, Buffer.from(base64Data, "base64"));

      await execFileAsync("libreoffice", [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        tmpDir,
        inputPath,
      ]);

      const pdfBuffer = await readFile(outputPath);
      return this.pdfToImages(pdfBuffer.toString("base64"));
    } finally {
      // Clean up temp files
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  }
}
