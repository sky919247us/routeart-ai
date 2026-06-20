// 把上傳圖片轉成「有序的輪廓點」(0..1 正規化座標)，供對齊道路用。
// 流程：載入 → 二值化(前景=不透明或深色) → Moore 鄰域邊界追蹤取最大外輪廓 → 道格拉斯-普克簡化。

export type Pt = { x: number; y: number }; // 正規化 0..1

const SIZE = 256; // 處理解析度，平衡品質與速度

/** 讀檔並二值化，回傳 {fg:boolean[], size}。fg[y*size+x]=是否前景。 */
async function loadBinary(file: File): Promise<{ fg: boolean[]; size: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("圖片載入失敗"));
      im.src = url;
    });
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d")!;
    // 等比置中縮放
    const scale = Math.min(SIZE / img.width, SIZE / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    // 判斷是否有 alpha 通道（透明背景圖）
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        hasAlpha = true;
        break;
      }
    }

    const fg: boolean[] = new Array(SIZE * SIZE);
    for (let p = 0; p < SIZE * SIZE; p++) {
      const r = data[p * 4];
      const g = data[p * 4 + 1];
      const b = data[p * 4 + 2];
      const a = data[p * 4 + 3];
      if (hasAlpha) {
        fg[p] = a > 128; // 透明背景：不透明處為前景
      } else {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        fg[p] = lum < 128; // 無 alpha：深色為前景(剪影)
      }
    }
    return { fg, size: SIZE };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Moore 鄰域邊界追蹤，取從左上掃到的第一個前景所屬外輪廓。 */
function traceBoundary(fg: boolean[], size: number): Pt[] {
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && fg[y * size + x];

  // 找起點：第一個前景像素
  let start = -1;
  for (let i = 0; i < fg.length; i++) {
    if (fg[i]) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];

  const sx = start % size;
  const sy = Math.floor(start / size);

  // 8 鄰域順時針方向
  const dirs = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  const contour: Pt[] = [];
  let cx = sx;
  let cy = sy;
  let dir = 6; // 起始往上找
  const maxSteps = size * size * 2;
  let steps = 0;

  do {
    contour.push({ x: cx / size, y: cy / size });
    let found = false;
    // 從 (dir+6)%8 開始逆掃，標準 Moore 追蹤
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = cx + dirs[nd][0];
      const ny = cy + dirs[nd][1];
      if (at(nx, ny)) {
        cx = nx;
        cy = ny;
        dir = nd;
        found = true;
        break;
      }
    }
    if (!found) break; // 孤立點
    steps++;
  } while ((cx !== sx || cy !== sy) && steps < maxSteps);

  return contour;
}

/** 道格拉斯-普克簡化。 */
function simplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  const dmax = { d: 0, i: 0 };
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], a, b);
    if (d > dmax.d) {
      dmax.d = d;
      dmax.i = i;
    }
  }
  if (dmax.d > epsilon) {
    const left = simplify(points.slice(0, dmax.i + 1), epsilon);
    const right = simplify(points.slice(dmax.i), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-9;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** 對外主函式：上傳圖片 → 簡化後的輪廓點（正規化 0..1，y 向下）。 */
export async function traceImageContour(file: File): Promise<Pt[]> {
  const { fg, size } = await loadBinary(file);
  const raw = traceBoundary(fg, size);
  if (raw.length < 8) throw new Error("無法從圖片找出輪廓，請改用對比明顯的剪影或透明背景圖。");
  // 目標控制在 ~60 點：先用較小 epsilon，過多再加大
  let eps = 0.004;
  let out = simplify(raw, eps);
  while (out.length > 80 && eps < 0.05) {
    eps *= 1.5;
    out = simplify(raw, eps);
  }
  return out;
}
