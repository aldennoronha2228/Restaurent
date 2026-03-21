"""
Direct YOLO test — bypasses the API/network entirely.
Run with: python test_direct.py
"""
from ultralytics import YOLO
import cv2, numpy as np

model = YOLO('yolov8n.pt')

# Test 1: Ultralytics built-in sample image (has people, bus — no table)
results = model('https://ultralytics.com/images/zidane.jpg', verbose=False)
labels = [model.names[int(b.cls[0])] for r in results for b in r.boxes]
print('Zidane image objects:', labels)

# Test 2: No class filter — detect everything at low conf
results2 = model('https://ultralytics.com/images/bus.jpg', conf=0.15, verbose=False)
labels2 = [model.names[int(b.cls[0])] for r in results2 for b in r.boxes]
print('Bus image objects:', labels2)

print()
print('Available COCO classes near furniture:')
for idx, name in model.names.items():
    if idx in [56, 57, 58, 59, 60, 61, 62, 63, 64, 65]:
        print(f'  class {idx}: {name}')
