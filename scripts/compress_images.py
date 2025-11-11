import os
import sys
import glob
import shutil
from PIL import Image

# Parse arguments
if len(sys.argv) > 1:
    # Single file mode: compress_images.py <filename>
    specific_file = sys.argv[1]
    source_dir = 'public/assets/logos/'
    target_dir = 'public/assets/compressedLogos/'
else:
    # Batch mode: compress all files
    specific_file = None
    source_dir = 'public/assets/logos/'
    target_dir = 'public/assets/compressedLogos/'

# Ensure target dir exists
os.makedirs(target_dir, exist_ok=True)

# Collect image files
if specific_file:
    # Process only the specified file
    source_path = os.path.join(source_dir, specific_file)
    if os.path.exists(source_path):
        all_files = [source_path]
    else:
        print(f"Error: File not found: {source_path}")
        sys.exit(1)
else:
    # Process all files
    extensions = ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp']
    all_files = []
    for ext in extensions:
        all_files.extend(glob.glob(os.path.join(source_dir, ext)))

max_size = 80 * 1024  # 80KB

for img_path in all_files:
    img = Image.open(img_path)
    filename = os.path.basename(img_path)
    base, _ = os.path.splitext(filename)
    target_path = os.path.join(target_dir, base + '.png')
    
    # If already exists and size <= max_size, skip
    if os.path.exists(target_path) and os.path.getsize(target_path) <= max_size:
        print(f"Skipped {img_path}, already compressed: {os.path.getsize(target_path)} bytes")
        continue
    
    # Copy original if small
    if os.path.getsize(img_path) <= max_size:
        shutil.copy2(img_path, target_path)
        print(f"Copied {img_path} to {target_path}, size: {os.path.getsize(target_path)} bytes")
        continue
    
    # Compress
    temp_img = img.copy()
    # Initial thumbnail
    temp_img.thumbnail((1024, 1024), Image.LANCZOS)
    
    while True:
        temp_path = os.path.join(target_dir, base + '_temp.png')
        temp_img.save(temp_path, 'PNG', optimize=True)
        if os.path.getsize(temp_path) <= max_size:
            os.replace(temp_path, target_path)
            print(f"Compressed {img_path} to {target_path}, size: {os.path.getsize(target_path)} bytes")
            break
        # Reduce size by 10%
        w, h = temp_img.size
        if w <= 50 or h <= 50:  # minimum size
            os.replace(temp_path, target_path)
            print(f"Compressed {img_path} to {target_path} (minimum size reached), size: {os.path.getsize(target_path)} bytes")
            break
        temp_img = temp_img.resize((int(w * 0.9), int(h * 0.9)), Image.LANCZOS)