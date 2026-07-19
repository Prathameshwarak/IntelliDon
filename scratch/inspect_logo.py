from PIL import Image

img = Image.open('public/logo.png')
width, height = img.size

col_counts = []
for x in range(width):
    count = 0
    for y in range(204, 633):
        r, g, b = img.getpixel((x, y))
        if r < 245 or g < 245 or b < 245:
            count += 1
    col_counts.append(count)

# Let's print blocks where count > 2 to see where the logo is horizontally
in_block = False
block_start = 0
for x, count in enumerate(col_counts):
    if count > 2 and not in_block:
        block_start = x
        in_block = True
    elif count <= 2 and in_block:
        print(f"Col Block: {block_start} to {x-1} (max count: {max(col_counts[block_start:x])})")
        in_block = False
if in_block:
    print(f"Col Block: {block_start} to {width-1} (max count: {max(col_counts[block_start:width])})")
