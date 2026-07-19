from halftone import Halftone 


# path = "/home/kevin/Documents/side_projects/half_tone_display/IMG_4299.jpg"
# path = "/home/kevinz/Documents/side-projects/halftone-display/fumo.jpg"
path = "/Users/kevinzhang/Documents/side-projects/halftone-display/cubes.jpg"
ht = Halftone(path)
ht.make(
        # style="grayscale", 
        style="color",
        sample=50,
        # save_channels_style="grayscale", 
        save_channels_style="color",
        output_quality=100,
        antialias=False
        )
