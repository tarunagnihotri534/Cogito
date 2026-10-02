import os
from PIL import Image, ImageDraw, ImageFont

WIDTH = 860
HEIGHT = 500
BG_COLOR = (22, 22, 30)         # TokyoNight Background
HEADER_BG = (31, 35, 53)       # Window header
BORDER_COLOR = (41, 46, 66)    # Window border
TEXT_COLOR = (192, 202, 245)    # Default foreground text
PROMPT_COLOR = (122, 162, 247)  # Primary blue/purple for prompt
CMD_COLOR = (115, 218, 202)     # Cyan/teal for command
SUCCESS_COLOR = (158, 206, 106) # Green for success/checks
WARN_COLOR = (224, 175, 104)    # Amber/yellow for warning
DIM_COLOR = (86, 95, 137)       # Muted comments/dim
HEADER_TITLE = (121, 130, 169)  # Window title color

FONT_PATH = "C:/Windows/Fonts/consola.ttf"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "consola.ttf"

font = ImageFont.truetype(FONT_PATH, 15)
font_bold = ImageFont.truetype(FONT_PATH, 15)
font_title = ImageFont.truetype(FONT_PATH, 13)

def create_base_window():
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer rounded rectangle
    radius = 12
    draw.rounded_rectangle([(0, 0), (WIDTH - 1, HEIGHT - 1)], radius=radius, fill=BG_COLOR, outline=BORDER_COLOR, width=1)
    
    # Header area
    header_height = 36
    draw.rounded_rectangle([(0, 0), (WIDTH - 1, header_height)], radius=radius, fill=HEADER_BG)
    draw.rectangle([(0, header_height - radius), (WIDTH - 1, header_height)], fill=HEADER_BG)
    draw.line([(0, header_height), (WIDTH - 1, header_height)], fill=BORDER_COLOR, width=1)
    
    # Window traffic light buttons
    btn_y = 18
    # Close (Red)
    draw.ellipse([(18, btn_y - 6), (30, btn_y + 6)], fill=(255, 95, 86))
    # Minimize (Yellow)
    draw.ellipse([(38, btn_y - 6), (50, btn_y + 6)], fill=(255, 189, 46))
    # Maximize (Green)
    draw.ellipse([(58, btn_y - 6), (70, btn_y + 6)], fill=(39, 201, 63))
    
    # Window title
    title = "tarun@dev: ~/project — cogito"
    bbox = font_title.getbbox(title)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, 10), title, fill=HEADER_TITLE, font=font_title)
    
    return img

def render_lines(lines, cursor=False):
    """
    lines is a list of tuples: (text, color_or_token_list)
    or a list of token segments: [(text, color), (text, color), ...]
    """
    img = create_base_window()
    draw = ImageDraw.Draw(img)
    
    start_x = 24
    start_y = 52
    line_height = 22
    
    cur_x = start_x
    cur_y = start_y
    
    for line in lines:
        cur_x = start_x
        if isinstance(line, list):
            for token_text, token_color in line:
                draw.text((cur_x, cur_y), token_text, fill=token_color, font=font)
                bbox = font.getbbox(token_text)
                cur_x += (bbox[2] - bbox[0])
        else:
            token_text, token_color = line
            draw.text((cur_x, cur_y), token_text, fill=token_color, font=font)
            bbox = font.getbbox(token_text)
            cur_x += (bbox[2] - bbox[0])
            
        cur_y += line_height
        
    if cursor:
        draw.rectangle([(cur_x + 2, cur_y - line_height + 3), (cur_x + 10, cur_y - 3)], fill=PROMPT_COLOR)
        
    return img.convert("RGB")

def build_animation():
    frames = []
    durations = []
    
    # Define script segments
    PROMPT = [("❯ ", PROMPT_COLOR)]
    
    # STEP 1: cogito init
    cmd1 = "cogito init"
    current_lines = []
    
    # Type cmd1
    for i in range(1, len(cmd1) + 1):
        line = PROMPT + [(cmd1[:i], CMD_COLOR)]
        frames.append(render_lines([line], cursor=True))
        durations.append(40)
        
    frames.append(render_lines([PROMPT + [(cmd1, CMD_COLOR)]], cursor=False))
    durations.append(300)
    
    # Output of init
    init_out = [
        PROMPT + [(cmd1, CMD_COLOR)],
        [("✔ Initialized institutional memory in ", SUCCESS_COLOR), (".decisions/", TEXT_COLOR)],
        [("  ├── active/       ", DIM_COLOR), ("(currently enforced decisions)", (154, 165, 206))],
        [("  ├── superseded/   ", DIM_COLOR), ("(historical lineage archive)", (154, 165, 206))],
        [("  ├── archived/     ", DIM_COLOR), ("(retired decisions)", (154, 165, 206))],
        [("  └── index.json    ", DIM_COLOR), ("(high-speed query cache)", (154, 165, 206))],
        [("", TEXT_COLOR)]
    ]
    frames.append(render_lines(init_out, cursor=False))
    durations.append(900)
    
    # STEP 2: cogito record
    cmd2_prefix = "cogito record --summary "
    cmd2_arg1 = '"Do not expose payment APIs to browser extension"'
    cmd2_arg2 = ' --scope "src/api/payments/**/*.ts,src/extension/**/*.ts"'
    
    full_cmd2 = cmd2_prefix + cmd2_arg1 + cmd2_arg2
    
    # Type cmd2 in chunks
    step_size = 3
    for i in range(step_size, len(full_cmd2) + step_size, step_size):
        sub = full_cmd2[:min(i, len(full_cmd2))]
        line = PROMPT + [(sub, CMD_COLOR)]
        frames.append(render_lines(init_out + [line], cursor=True))
        durations.append(35)
        
    frames.append(render_lines(init_out + [PROMPT + [(full_cmd2, CMD_COLOR)]], cursor=False))
    durations.append(400)
    
    record_out = init_out + [
        PROMPT + [(full_cmd2, CMD_COLOR)],
        [("✔ Saved decision ", SUCCESS_COLOR), ("dec_20260728_x8k2p9", (247, 118, 142)), (" to .decisions/active/", TEXT_COLOR)],
        [("✔ Rebuilt decision index (1 active decision indexed in 3ms)", SUCCESS_COLOR)],
        [("", TEXT_COLOR)]
    ]
    frames.append(render_lines(record_out, cursor=False))
    durations.append(1100)
    
    # STEP 3: Clear screen for check
    cmd3 = "cogito check src/extension/api/client.ts"
    check_lines = []
    for i in range(1, len(cmd3) + 1):
        line = PROMPT + [(cmd3[:i], CMD_COLOR)]
        frames.append(render_lines([line], cursor=True))
        durations.append(35)
        
    frames.append(render_lines([PROMPT + [(cmd3, CMD_COLOR)]], cursor=False))
    durations.append(400)
    
    check_out = [
        PROMPT + [(cmd3, CMD_COLOR)],
        [("⚠️  1 Architectural Decision matches 'src/extension/api/client.ts':", WARN_COLOR)],
        [("──────────────────────────────────────────────────────────────────────────", DIM_COLOR)],
        [("ID:        ", DIM_COLOR), ("dec_20260728_x8k2p9", (247, 118, 142))],
        [("Summary:   ", DIM_COLOR), ("Do not expose payment APIs to browser extension", TEXT_COLOR)],
        [("Rationale: ", DIM_COLOR), ("PCI DSS scope isolation — extension context lacks strict isolation", (187, 154, 247))],
        [("Scope:     ", DIM_COLOR), ("src/api/payments/**/*.ts, src/extension/**/*.ts", (122, 162, 247))],
        [("Tags:      ", DIM_COLOR), ("security, payments, extension", (158, 206, 106))],
        [("Author:    ", DIM_COLOR), ("tarunagnihotri", TEXT_COLOR)],
        [("──────────────────────────────────────────────────────────────────────────", DIM_COLOR)],
        [("💡 Advisory only: Proceed with modifications or update decision.", (115, 218, 202))]
    ]
    frames.append(render_lines(check_out, cursor=False))
    # Hold the final result for 3 seconds before looping
    durations.append(3200)
    
    output_path = "docs/images/demo.gif"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Optimize palette
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True
    )
    
    size_kb = os.path.getsize(output_path) / 1024
    print(f"Generated {output_path} with {len(frames)} frames, size: {size_kb:.1f} KB")

if __name__ == "__main__":
    build_animation()
