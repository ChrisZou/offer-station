const MAX_FILE_BYTES = 18 * 1024 * 1024;
const MAX_PAGES = 6;

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.86) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function imageFileToDataUrl(file: File) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法处理该图片");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas);
  } finally { URL.revokeObjectURL(source); }
}

export async function prepareResumePages(file: File, onProgress?: (message: string) => void) {
  if (file.size > MAX_FILE_BYTES) throw new Error("文件超过 18MB，请压缩后重试");
  if (/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
    onProgress?.("正在优化图片…");
    return [await imageFileToDataUrl(file)];
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("仅支持 PDF、JPG、PNG 和 WebP 简历");
  onProgress?.("正在本地读取 PDF…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (document.numPages > MAX_PAGES) throw new Error(`当前支持最多 ${MAX_PAGES} 页，请上传精简版简历`);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress?.(`正在转换第 ${pageNumber}/${document.numPages} 页…`);
    const page = await document.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.2, 1600 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法渲染 PDF");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push(canvasToJpeg(canvas));
    page.cleanup();
  }
  await document.destroy();
  return pages;
}

export async function blobUrlToDataUrl(url: string) {
  const blob = await fetch(url).then((response) => response.blob());
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取当前简历预览"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
