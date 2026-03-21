import uvicorn
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware

# ─── Thread pool for CPU-bound YOLO inference ───────────────────────────────
# FastAPI is async; blocking inference on the event-loop freezes all requests.
executor = ThreadPoolExecutor(max_workers=2)

model: YOLO = None  # type: ignore

def load_and_warmup():
    """Load model and run a dummy inference to JIT-compile everything."""
    global model
    model = YOLO('yolov8n.pt')
    dummy = np.zeros((320, 320, 3), dtype=np.uint8)
    model(dummy, classes=[56, 60], conf=0.15, iou=0.45, imgsz=320, verbose=False)
    print("✅ YOLO warmed up — ready for live inference")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up in a thread so startup doesn't block
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, load_and_warmup)
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FURNITURE_CLASSES = [56, 60]  # chair, dining table

def run_inference(img: np.ndarray) -> list:
    """Synchronous YOLO inference — runs in the thread pool."""
    results = model(
        img,
        classes=FURNITURE_CLASSES,
        conf=0.15,
        iou=0.45,
        imgsz=320,   # 320px: ~60ms on CPU vs ~250ms at 640px
        verbose=False,
    )

    raw = []
    for r in results:
        for box in r.boxes:
            b = box.xywh[0].tolist()
            raw.append({
                "cx":         b[0],
                "cy":         b[1],
                "w":          b[2],
                "h":          b[3],
                "confidence": float(box.conf[0]),
                "cls":        int(box.cls[0]),
            })

    # Scale back to original image size (inference was at 320)
    h, w = img.shape[:2]
    sx, sy = w / 320, h / 320
    for item in raw:
        item["cx"] *= sx
        item["cy"] *= sy
        item["w"]  *= sx
        item["h"]  *= sy

    # ── Chair-cluster → synthetic table box ──
    chairs = [b for b in raw if b["cls"] == 56]
    tables = [b for b in raw if b["cls"] == 60]

    visited = [False] * len(chairs)
    clusters = []
    for i, c in enumerate(chairs):
        if visited[i]:
            continue
        group = [c]
        visited[i] = True
        for j, d in enumerate(chairs):
            if not visited[j] and abs(c["cx"] - d["cx"]) < 220 and abs(c["cy"] - d["cy"]) < 220:
                group.append(d)
                visited[j] = True
        if len(group) >= 2:
            cx = sum(g["cx"] for g in group) / len(group)
            cy = sum(g["cy"] for g in group) / len(group)
            w  = max(g["cx"] for g in group) - min(g["cx"] for g in group) + 80
            h_  = max(g["cy"] for g in group) - min(g["cy"] for g in group) + 80
            clusters.append({
                "cx": cx, "cy": cy,
                "w": max(float(w), 80.0), "h": max(h_, 80.0),
                "confidence": max(g["confidence"] for g in group),
            })

    boxes = []
    # ── MOCK INTEGRATION: VLM & Metric Depth logic applied per box ──
    # Compute screen height to fake depth based on position
    screen_h = img.shape[0]

    def enrich_box(b):
        # 1. Depth Pro Absolute Depth reasoning (mock)
        bottom_y = b["cy"] + (b["h"] / 2)
        percentage_down = max(0.01, (bottom_y - (screen_h / 2)) / (screen_h / 2))
        absolute_depth_z = min(1.0 / percentage_down, 15.0)  

        # 2. Qwen-VL Spatial reasoning (mock based on math)
        aspect_ratio = float(b["w"]) / max(float(b["h"]), 1.0)
        inferred_type = "booth" if aspect_ratio > 1.3 else "standard"
        inferred_orientation = 90 if aspect_ratio > 1.5 else 0
        seats = 6 if aspect_ratio > 1.3 else 4

        b["depth_z"] = absolute_depth_z
        b["semantic_type"] = inferred_type
        b["orientation"] = inferred_orientation
        b["seats"] = seats
        return b

    for t in tables:
        boxes.append(enrich_box({"cx": t["cx"], "cy": t["cy"], "w": t["w"], "h": t["h"], "confidence": t["confidence"]}))
    for c in clusters:
        boxes.append(enrich_box(c))
        
    return boxes


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"boxes": []}

    # Offload blocking inference to thread pool — never blocks the event loop
    loop = asyncio.get_event_loop()
    boxes = await loop.run_in_executor(executor, run_inference, img)
    return {"boxes": boxes}


if __name__ == "__main__":
    uvicorn.run("yolo_api:app", host="0.0.0.0", port=8000, reload=False)
