import { useRef, useState } from "react";
import { traceImageContour, type Pt } from "../lib/imageTrace";
import { fetchRoadNodes, bboxAreaKm2, MAX_AREA_KM2 } from "../lib/overpass";
import { snapToRoad } from "../lib/snap";
import type { RoutePoint } from "../store";

type Props = {
  bbox: [number, number, number, number] | null;
  snapTolerance: number;
  onApply: (points: RoutePoint[]) => void;
  onClose: () => void;
};

export default function ImagePanel({ bbox, snapTolerance, onApply, onClose }: Props) {
  const [contour, setContour] = useState<Pt[]>([]);
  const [sizeKm, setSizeKm] = useState(1.5);
  const [snap, setSnap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  function drawPreview(pts: Pt[]) {
    const c = previewRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (pts.length < 2) return;
    ctx.strokeStyle = "#4361ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x * c.width;
      const y = p.y * c.height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const pts = await traceImageContour(file);
      setContour(pts);
      requestAnimationFrame(() => drawPreview(pts));
    } catch (err) {
      setError((err as Error).message);
      setContour([]);
    } finally {
      setBusy(false);
    }
  }

  /** 以目前地圖中心為基準，放一個邊長 sizeKm 的正方形範圍，把輪廓對映進去。 */
  function placementBbox(): [number, number, number, number] {
    const [s, w, n, e] = bbox!;
    const centerLat = (s + n) / 2;
    const centerLng = (w + e) / 2;
    const half = sizeKm / 2;
    const dLat = half / 111.32;
    const dLng = half / (111.32 * Math.cos((centerLat * Math.PI) / 180));
    return [centerLat - dLat, centerLng - dLng, centerLat + dLat, centerLng + dLng];
  }

  async function apply() {
    setError("");
    if (!bbox) {
      setError("請先移動地圖到想放置圖案的區域。");
      return;
    }
    if (contour.length < 2) {
      setError("請先上傳並成功描出輪廓。");
      return;
    }
    setBusy(true);
    try {
      const pb = placementBbox();
      const [s, w, n, e] = pb;

      // 輪廓(0..1, y向下) → 經緯度
      const mapped = contour.map((p) => ({
        lat: n - p.y * (n - s),
        lng: w + p.x * (e - w),
      }));

      let route: RoutePoint[];
      if (snap) {
        if (bboxAreaKm2(pb) > MAX_AREA_KM2) {
          throw new Error(`放置範圍 ${sizeKm} km 太大，請調小尺寸。`);
        }
        const nodes = await fetchRoadNodes(pb);
        if (nodes.length === 0) throw new Error("這個區域沒抓到道路，改用較大尺寸或換地點。");
        route = mapped.map((pt) => {
          const r = snapToRoad(pt, nodes, snapTolerance);
          return { ...r.point, snapped: r.snapped };
        });
      } else {
        route = mapped.map((pt) => ({ ...pt, snapped: false }));
      }

      onApply(route);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(ev) => ev.stopPropagation()}>
        <h2>🖼️ 上傳圖片轉路線</h2>

        <div className="pattern-body">
          <div className="pattern-art">
            <canvas ref={previewRef} width={360} height={360} className="trace-preview" />
            <small>描出的輪廓預覽（藍線）</small>
          </div>

          <div className="pattern-results">
            <label className="field">
              <span>選擇圖片（剪影或透明背景效果最佳）</span>
              <input type="file" accept="image/*" onChange={onFile} />
            </label>

            <label className="field">
              <span>放置尺寸：{sizeKm.toFixed(1)} km（地圖中心為準）</span>
              <input
                type="range"
                min={0.4}
                max={2.4}
                step={0.1}
                value={sizeKm}
                onChange={(ev) => setSizeKm(Number(ev.target.value))}
              />
            </label>

            <label className="field checkbox">
              <input type="checkbox" checked={snap} onChange={(ev) => setSnap(ev.target.checked)} />
              <span>對齊道路（關閉＝保留原圖形狀，空中畫線）</span>
            </label>

            {contour.length > 0 && <small>輪廓點數：{contour.length}</small>}
            {error && <p className="err-msg">⚠️ {error}</p>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            取消
          </button>
          <button onClick={apply} disabled={busy || contour.length < 2}>
            {busy ? "處理中…" : "產生路線"}
          </button>
        </div>
      </div>
    </div>
  );
}
