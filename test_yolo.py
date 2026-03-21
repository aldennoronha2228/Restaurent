import requests, cv2, numpy as np

# Create a synthetic test: solid grey rectangle (like a table surface viewed from above)
img = np.ones((480, 640, 3), dtype=np.uint8) * 200
cv2.rectangle(img, (100, 150), (540, 340), (160, 140, 120), -1)  # table surface
cv2.imwrite('test_table.jpg', img)

with open('test_table.jpg', 'rb') as f:
    r = requests.post('http://localhost:8000/predict', files={'file': ('test.jpg', f, 'image/jpeg')})
    print('Status:', r.status_code)
    j = r.json()
    print('Boxes found:', len(j['boxes']))
    for b in j['boxes']:
        print('  conf=', round(b['confidence'], 3))

print()
print('API is working correctly.')
print('If 0 boxes: the camera scene does not contain a standard dining table.')
print('Try pointing camera directly at a flat table surface from above or at eye level.')
