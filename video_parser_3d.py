import cv2
import json
import math
import uuid
from typing import Dict, List, Tuple
from collections import OrderedDict
import numpy as np
from ultralytics import YOLO

# ─── 1. Mathematical PnP Conversion ──────────────────────────────────────────
def pixel_to_3d(u: float, v: float, depth_z: float, focal_length_x: float, focal_length_y: float, center_x: float, center_y: float) -> Tuple[float, float, float]:
    """
    Transforms 2D pixel + metric depth into 3D world coordinates.
    """
    X = (u - center_x) * depth_z / focal_length_x
    Y = (v - center_y) * depth_z / focal_length_y
    Z = depth_z
    return float(X), float(Y), float(Z)

# ─── 2. Robust Centroid Tracker (SORT Alternative) ───────────────────────────
class CentroidTracker:
    def __init__(self, max_disappeared=30, max_distance=150):
        self.next_obj_id = 0
        self.objects = OrderedDict()
        self.disappeared = OrderedDict()
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def register(self, centroid):
        obj_id = f"FURNITURE-{str(uuid.uuid4())[:8].upper()}"
        self.objects[obj_id] = centroid
        self.disappeared[obj_id] = 0
        return obj_id

    def deregister(self, obj_id):
        del self.objects[obj_id]
        del self.disappeared[obj_id]

    def update(self, rects):
        if len(rects) == 0:
            for obj_id in list(self.disappeared.keys()):
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    self.deregister(obj_id)
            return self.objects

        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for (i, (startX, startY, endX, endY)) in enumerate(rects):
            cX = int((startX + endX) / 2.0)
            cY = int((startY + endY) / 2.0)
            input_centroids[i] = (cX, cY)

        if len(self.objects) == 0:
            for i in range(0, len(input_centroids)):
                self.register(input_centroids[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            # Compute Euclidean distance between existing objects and new input centroids
            D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows, used_cols = set(), set()
            for (row, col) in zip(rows, cols):
                if row in used_rows or col in used_cols: continue
                if D[row, col] > self.max_distance: continue

                obj_id = object_ids[row]
                self.objects[obj_id] = input_centroids[col]
                self.disappeared[obj_id] = 0
                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(0, D.shape[0])).difference(used_rows)
            unused_cols = set(range(0, D.shape[1])).difference(used_cols)

            for row in unused_rows:
                obj_id = object_ids[row]
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    self.deregister(obj_id)

            for col in unused_cols:
                self.register(input_centroids[col])

        return self.objects

# ─── 3. Apple Depth Pro Model (Live Integration) ─────────────────────────────
# To run this, you must install Apple's official repo:
# pip install git+https://github.com/apple/ml-depth-pro.git
try:
    import depth_pro
    from PIL import Image
    DEPTH_PRO_AVAILABLE = True
except ImportError:
    DEPTH_PRO_AVAILABLE = False
    print("Warning: Apple's ML-Depth-Pro not installed. Falling back to geometric approximations.")

class DepthProEngine:
    def __init__(self):
        if DEPTH_PRO_AVAILABLE:
            print("Loading Apple Depth Pro Model onto GPU...")
            # Automatically downloads weights the first time
            self.model, self.transform = depth_pro.create_model_and_transforms()
            self.model.eval()
        else:
            self.model = None

    def infer(self, frame: np.ndarray, bbox: list) -> float:
        """
        Passes the RGB frame to Apple Depth Pro and extracts the median 
        metric depth precisely where the bounding box touches the floor.
        """
        x1, y1, x2, y2 = bbox
        
        if not DEPTH_PRO_AVAILABLE:
            bottom_y = y2
            screen_h = frame.shape[0]
            percentage_down = max(0.01, (bottom_y - (screen_h / 2)) / (screen_h / 2))
            return min(1.0 / percentage_down, 15.0)

        # 1. Convert OpenCV BGR to RGB PIL Image (required by Depth Pro)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)

        # 2. Run Depth Pro Inference
        # In a real pipeline, we only run depth.infer() ONCE per frame, not per box, 
        # but encapsulated here for structural example.
        input_tensor = self.transform(pil_img)
        # Assuming f_px approximated based on typical fields of view
        result = self.model.infer(input_tensor, f_px=rgb_frame.shape[1] * 0.8)
        
        # 3. Extract the high-res 2D metric depth map
        depth_map = result["depth"].cpu().numpy()

        # 4. Map the bounding box coordinates to the Depth Map tensor
        # We explicitly crop the bottom 10% of the bounding box to capture 
        # where the table legs hit the floor (the most accurate metric anchor)
        floor_crop = depth_map[int(y2 - (y2-y1)*0.1):int(y2), int(x1):int(x2)]
        
        # Ignore noisy edges or nan values by taking the metric median
        if floor_crop.size > 0:
            median_metric_depth = np.nanmedian(floor_crop)
            return float(median_metric_depth)
        
        return 5.0 # Fallback 5 meters if bounding box is corrupted
      # ─── 4. Qwen-VL Engine (Live Local LLM Integration) ──────────────────────────
try:
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
    from qwen_vl_utils import process_vision_info
    import torch
    QWEN_AVAILABLE = True
except ImportError:
    QWEN_AVAILABLE = False
    print("Warning: transformers or qwen_vl_utils not installed. Mocking VLM.")

class QwenVLEngine:
    def __init__(self):
        self.cached_analysis = {}
        if QWEN_AVAILABLE:
            print("Loading Qwen-VL Model (The Architect) onto GPU...")
            # We use float16 or bfloat16 to fit this massive model in VRAM
            self.model = Qwen2VLForConditionalGeneration.from_pretrained(
                "Qwen/Qwen2-VL-7B-Instruct", 
                torch_dtype=torch.bfloat16, 
                device_map="auto"
            )
            self.processor = AutoProcessor.from_pretrained("Qwen/Qwen2-VL-7B-Instruct")
        else:
            self.model = None

    def analyze_furniture(self, frame: np.ndarray, bbox: list, obj_id: str) -> dict:
        """
        Crops the object, passes it into Qwen-VL, and asks it to determine the 
        exact table shape and orientation based on a zero-shot prompt.
        """
        # Always return cache if we've already run the heavy VLM on this UUID
        if obj_id in self.cached_analysis:
            return self.cached_analysis[obj_id]

        x1, y1, x2, y2 = map(int, bbox)
        
        if not QWEN_AVAILABLE:
            width, height = (x2 - x1), (y2 - y1)
            aspect_ratio = float(width) / max(float(height), 1.0)
            inference = {
                "type": "rectangular booth" if aspect_ratio > 1.4 else "circular 4-seater", 
                "orientation_degrees": 90 if aspect_ratio > 1.4 else 45
            }
            self.cached_analysis[obj_id] = inference
            return inference

        # 1. Crop Image & Convert
        # We pad the crop by 30 pixels so Qwen can see the surrounding context
        pad_y, pad_x = 30, 30
        h, w = frame.shape[:2]
        crop = frame[max(0, y1-pad_y):min(h, y2+pad_y), max(0, x1-pad_x):min(w, x2+pad_x)]
        
        rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        pil_crop = Image.fromarray(rgb_crop)

        # 2. Prepare the Architect's Prompt
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": pil_crop},
                    {"type": "text", "text": "Act as a spatial architect. Analyze this restaurant furniture crop. Determine its type (e.g. 'circular 4-seater', 'rectangular 6-seater booth') and its orientation in degrees (0 to 360). Reply ONLY in strict JSON format: {\"type\": \"<string>\", \"orientation_degrees\": <int>}"}
                ],
            }
        ]

        # 3. Process image and generate text
        text = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        ).to("cuda")

        # Generate!
        generated_ids = self.model.generate(**inputs, max_new_tokens=100)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = self.processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]

        # 4. Parse the AI JSON (Fallback to safe defaults if hallucinated)
        try:
            # We strip out any markdown formatting the LLM might hallucinate around the JSON
            clean_str = output_text.strip().replace("```json", "").replace("```", "").strip()
            inference = json.loads(clean_str)
        except json.JSONDecodeError:
            inference = {"type": "standard table", "orientation_degrees": 0}

        self.cached_analysis[obj_id] = inference
        return inference

# ─── 5. The Main Automated Pipeline ──────────────────────────────────────────
class FloorPlanPipeline:
    def __init__(self):
        # Using YOLOv8n to represent the specific lightweight YOLO structure
        self.yolo_detector = YOLO('yolov8n.pt')
        self.tracker = CentroidTracker(max_disappeared=45, max_distance=200)
        self.depth_pro = DepthProEngine()
        self.qwen_vl = QwenVLEngine()
        
        # COCO IDs for indoor mapping
        self.target_classes = [56, 57, 60]  # Chair, Couch, Dining Table

        # The global geometric database
        self.scanned_environment = {}

    def process_video_file(self, video_path: str, output_json: str):
        cap = cv2.VideoCapture(video_path)
        frame_width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Approximated camera intrinsics for PnP math
        cf_x = frame_width * 0.82
        cf_y = frame_height * 0.82
        cc_x = frame_width / 2.0
        cc_y = frame_height / 2.0

        print(f"Starting pipeline on {video_path}...")
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            frame_count += 1

            # 1. High-speed YOLO Detection inference
            results = self.yolo_detector(frame, classes=self.target_classes, verbose=False)
            
            rects = []
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    rects.append((int(x1), int(y1), int(x2), int(y2)))

            # 2. Update Global UUID Tracker
            tracked_objects = self.tracker.update(rects)

            # 3. Match YOLO boxes back to UUIDs for VLM + Depth Processing
            for (obj_id, centroid) in tracked_objects.items():
                cx, cy = centroid
                
                # Find the bounding box matching this centroid
                matching_box = None
                for (x1, y1, x2, y2) in rects:
                    if int((x1 + x2) / 2) == cx and int((y1 + y2) / 2) == cy:
                        matching_box = (x1, y1, x2, y2)
                        break
                
                if not matching_box:
                    continue

                # A. Apply Depth Pro Math
                z_depth_meters = self.depth_pro.infer(frame, matching_box)
                u = matching_box[0] + (matching_box[2] - matching_box[0]) / 2 # Center X
                v = matching_box[3] # Bottom Y (Floor contact point)
                
                # Execute PnP transformation
                world_x, world_y, world_z = pixel_to_3d(u, v, z_depth_meters, cf_x, cf_y, cc_x, cc_y)

                # B. Execute VLM Intelligence (only runs once per UUID to save VRAM)
                semantic_data = self.qwen_vl.analyze_furniture(frame, matching_box, obj_id)

                # C. Data Registration with Exponential Moving Average
                if obj_id not in self.scanned_environment:
                    self.scanned_environment[obj_id] = {
                        "id": obj_id,
                        "type": semantic_data["type"],
                        "orientation_degrees": semantic_data["orientation_degrees"],
                        "coordinates": {"x": world_x, "y": world_y, "z": world_z},
                        "confidence_frames": 1
                    }
                else:
                    # EM Average to smooth camera movement jitter
                    old_c = self.scanned_environment[obj_id]["coordinates"]
                    self.scanned_environment[obj_id]["coordinates"]["x"] = old_c["x"] * 0.7 + world_x * 0.3
                    self.scanned_environment[obj_id]["coordinates"]["y"] = old_c["y"] * 0.7 + world_y * 0.3
                    self.scanned_environment[obj_id]["coordinates"]["z"] = old_c["z"] * 0.7 + world_z * 0.3
                    self.scanned_environment[obj_id]["confidence_frames"] += 1

        cap.release()
        
        # 4. Filter out ghosts (UUIDs seen less than 5 times) and Export
        final_layout = [
            data for data in self.scanned_environment.values() 
            if data["confidence_frames"] >= 5
        ]

        with open(output_json, 'w') as f:
            json.dump({"layout": final_layout, "total_furniture": len(final_layout)}, f, indent=4)
        
        print(f"Pipeline Complete. Processed {frame_count} frames.")
        print(f"Exported {len(final_layout)} fully reasoned 3D objects to {output_json}")


if __name__ == "__main__":
    # To run this in production, pass the actual video file path you capture on your phone
    # e.g., pipeline.process_video_file('restaurant_walkthrough.mp4', 'output_floorplan.json')
    pipeline = FloorPlanPipeline()
    print("Ready to execute multi-model computer vision pipeline.")
