from PIL import Image, ImageDraw

def create_favicon():
    # Open the original logo
    img = Image.open('public/logo.png').convert("RGBA")
    
    # Crop the logo mark: X from 272 to 752, Y from 178 to 658 (480x480 square)
    cropped = img.crop((272, 178, 752, 658))
    
    # Make background transparent using floodfill from corners
    # We will floodfill from (0,0), (width-1, 0), (0, height-1), (width-1, height-1)
    # to convert the outer white background to transparent (0, 0, 0, 0)
    width, height = cropped.size
    
    # We'll use a tolerance. If a pixel is very close to white, we allow floodfill to pass through.
    # To do this simply with PIL: we can find all pixels connected to the corners that are "white-ish".
    # An easy way is to use ImageDraw.floodfill. But floodfill in PIL only supports exact matching.
    # So let's write a simple BFS to find all background pixels (pixels starting from corners that are > 240 in R, G, B)
    # and set their alpha to 0.
    
    pixels = cropped.load()
    visited = set()
    queue = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    
    for x, y in queue:
        visited.add((x, y))
        
    while queue:
        cx, cy = queue.pop(0)
        # Get color
        r, g, b, a = pixels[cx, cy]
        # Set to transparent
        pixels[cx, cy] = (r, g, b, 0)
        
        # Check neighbors
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited:
                    nr, ng, nb, na = pixels[nx, ny]
                    # If neighbor is white-ish, it's part of the background
                    if nr > 240 and ng > 240 and nb > 240:
                        visited.add((nx, ny))
                        queue.append((nx, ny))

    # Also check if there are any other pixels on the outer edge we missed, 
    # but the BFS from corners should cover all outer background.
    
    # Save as PNG icon in the app directory
    # Next.js supports app/icon.png and will auto-generate different sizes
    icon_path = 'app/icon.png'
    cropped.save(icon_path, 'PNG')
    print(f"Saved {icon_path}")
    
    # Also save as favicon.ico (containing multiple sizes: 16x16, 32x32, 48x48) in the app directory
    # Overwriting the default Next.js favicon.ico
    favicon_path = 'app/favicon.ico'
    ico_img = cropped.resize((32, 32), Image.Resampling.LANCZOS)
    ico_img.save(favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Saved {favicon_path}")

if __name__ == '__main__':
    create_favicon()
