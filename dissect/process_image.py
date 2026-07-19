import cv2
import numpy as np
import json
import matplotlib.pyplot as plt

def extract_boundary_from_image(image_path, output_path=None, epsilon_factor=0.01, max_vertices=50):
    """
    Extract boundary from image with transparent background and create triangulation
    """
    # Load image with alpha channel
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    
    if img is None:
        print(f"Error: Could not load image from {image_path}")
        return None, None
    
    print(f"Image shape: {img.shape}")
    
    # Check if image has alpha channel
    if img.shape[2] != 4:
        print("Error: Image must have alpha channel (RGBA)")
        return None, None
    
    # Extract alpha channel
    alpha = img[:, :, 3]
    
    # Create binary mask (non-transparent pixels)
    mask = (alpha > 0).astype(np.uint8) * 255
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("No contours found")
        return None, None
    
    # Get the largest contour
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Iteratively adjust epsilon to get as close to target vertex count as possible
    target_vertices = max_vertices
    epsilon = epsilon_factor * cv2.arcLength(largest_contour, True)
    approx_contour = cv2.approxPolyDP(largest_contour, epsilon, True)
    
    # Binary search approach to find the right epsilon for target vertices
    min_epsilon = 0.001 * cv2.arcLength(largest_contour, True)
    max_epsilon = 0.1 * cv2.arcLength(largest_contour, True)
    
    best_contour = approx_contour
    best_diff = abs(len(approx_contour) - target_vertices)
    
    for _ in range(20):  # Maximum iterations
        if len(approx_contour) > target_vertices:
            min_epsilon = epsilon
            epsilon = (epsilon + max_epsilon) / 2
        elif len(approx_contour) < target_vertices:
            max_epsilon = epsilon
            epsilon = (min_epsilon + epsilon) / 2
        else:
            break  # Found exact match
            
        approx_contour = cv2.approxPolyDP(largest_contour, epsilon, True)
        diff = abs(len(approx_contour) - target_vertices)
        
        if diff < best_diff:
            best_diff = diff
            best_contour = approx_contour
            
        if max_epsilon - min_epsilon < 0.001:
            break
    
    approx_contour = best_contour
    
    # Convert to list of [x, y] coordinates
    boundary_vertices = []
    for point in approx_contour:
        x, y = point[0]
        boundary_vertices.append([float(x), float(y)])
    
    print(f"Extracted {len(boundary_vertices)} boundary vertices")
    
    # Ensure counter-clockwise orientation
    boundary_vertices = ensure_counter_clockwise(boundary_vertices)
    
    # Create radial triangulation
    triangles = radial_triangulation(boundary_vertices)
    
    # Save boundary vertices
    boundary_output_path = 'lunar_moth_boundary_vertices.json'
    formatted_vertices = []
    for vertex in boundary_vertices:
        formatted_vertex = {
            "x": vertex[0],
            "y": vertex[1],
            "color": "#FF0000"  # Default red color
        }
        formatted_vertices.append(formatted_vertex)
    
    vertices_data = {"vertices": formatted_vertices}
    with open(boundary_output_path, 'w') as f:
        json.dump(vertices_data, f, indent=2)
    print(f"Boundary vertices saved to {boundary_output_path}")
    
    # Save triangles in the format expected by JavaScript
    triangles_output_path = 'lunar_moth_triangles.json'
    formatted_triangles = []
    for triangle in triangles:
        formatted_triangle = {
            "vertices": [
                {"x": triangle[0][0], "y": triangle[0][1]},
                {"x": triangle[1][0], "y": triangle[1][1]},
                {"x": triangle[2][0], "y": triangle[2][1]}
            ]
        }
        formatted_triangles.append(formatted_triangle)
    
    triangles_data = {"triangles": formatted_triangles}
    with open(triangles_output_path, 'w') as f:
        json.dump(triangles_data, f, indent=2)
    print(f"Triangles saved to {triangles_output_path}")
    
    # Visualize if output path provided
    if output_path:
        visualize_boundary_and_triangles(img, boundary_vertices, triangles, output_path)
    
    return boundary_vertices, triangles

def polygon_centroid(vertices):
    """Calculate the centroid of a polygon"""
    n = len(vertices)
    cx = sum(v[0] for v in vertices) / n
    cy = sum(v[1] for v in vertices) / n
    return [cx, cy]

def radial_triangulation(vertices):
    """
    Create triangulation by connecting center to all boundary edges
    """
    if len(vertices) < 3:
        return []
    
    # Calculate centroid
    center = polygon_centroid(vertices)
    
    triangles = []
    n = len(vertices)
    
    # Create triangles from center to each edge
    for i in range(n):
        next_i = (i + 1) % n
        triangle = [
            center,
            vertices[i],
            vertices[next_i]
        ]
        triangles.append(triangle)
    
    return triangles

def polygon_area_signed(vertices):
    """Calculate signed area of polygon (positive for counter-clockwise)"""
    n = len(vertices)
    area = 0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i][0] * vertices[j][1]
        area -= vertices[j][0] * vertices[i][1]
    return area / 2

def ensure_counter_clockwise(vertices):
    """Ensure vertices are in counter-clockwise order"""
    if polygon_area_signed(vertices) < 0:
        return vertices[::-1]  # Reverse if clockwise
    return vertices

def visualize_boundary_and_triangles(img, boundary_vertices, triangles, output_path):
    """Visualize the original image with boundary and triangles overlaid"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 7))
    
    # Original image
    ax1.imshow(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA))
    ax1.set_title('Original Image')
    ax1.axis('off')
    
    # Boundary and triangles
    ax2.imshow(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA))
    
    # Draw triangles
    for triangle in triangles:
        triangle_array = np.array(triangle + [triangle[0]])  # Close the triangle
        ax2.plot(triangle_array[:, 0], triangle_array[:, 1], 'r-', linewidth=1, alpha=0.7)
    
    # Draw boundary
    boundary_array = np.array(boundary_vertices + [boundary_vertices[0]])
    ax2.plot(boundary_array[:, 0], boundary_array[:, 1], 'b-', linewidth=2)
    ax2.scatter([v[0] for v in boundary_vertices], [v[1] for v in boundary_vertices], 
               c='blue', s=30, zorder=5)
    
    # Draw center point
    center = polygon_centroid(boundary_vertices)
    ax2.scatter(center[0], center[1], c='red', s=50, zorder=6, marker='*')
    
    ax2.set_title(f'Radial Triangulation ({len(triangles)} triangles)')
    ax2.axis('off')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.show()

if __name__ == "__main__":
    # Process the lunar moth image
    image_path = "lunar_moth_no_bg.png"
    output_path = "lunar_moth_boundary_triangulation.png"
    
    boundary_vertices, triangles = extract_boundary_from_image(
        image_path, 
        output_path=output_path,
        epsilon_factor=0.01,  # Adjust for smoother/more detailed boundary
        max_vertices=30       # Set to 30 vertices as requested
    )
    
    if boundary_vertices and triangles:
        print(f"Successfully extracted {len(boundary_vertices)} vertices and {len(triangles)} triangles")
    else:
        print("Failed to extract boundary")
