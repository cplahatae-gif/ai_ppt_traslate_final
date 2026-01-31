import zipfile
import re
from collections import defaultdict

def analyze_pptx_styles(ppt_path, label, output_file):
    """Analyze PPT XML to extract all style information"""
    with open(output_file, 'a', encoding='utf-8') as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"{label}\n")
        f.write(f"{'='*60}\n")
        
        colors = defaultdict(int)
        highlights = defaultdict(int)
        underlines = 0
        bolds = 0
        
        with zipfile.ZipFile(ppt_path, 'r') as z:
            for name in z.namelist():
                if 'slide' in name and name.endswith('.xml'):
                    content = z.read(name).decode('utf-8')
                    
                    # Count solidFill colors
                    for match in re.findall(r'<a:solidFill>\s*<a:srgbClr val="([A-F0-9]+)"', content):
                        colors[match] += 1
                    
                    # Count highlights
                    for match in re.findall(r'<a:highlight>\s*<a:srgbClr val="([A-F0-9]+)"', content):
                        highlights[match] += 1
                    
                    # Count underlines
                    underlines += len(re.findall(r'u="sng"', content))
                    
                    # Count bolds
                    bolds += len(re.findall(r'b="1"', content))
        
        f.write(f"Bolds: {bolds}\n")
        f.write(f"Underlines: {underlines}\n")
        f.write(f"Colors (text foreground): {dict(colors)}\n")
        f.write(f"Highlights (background): {dict(highlights)}\n")

output_file = r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\ai ppt 번역기\2. ppt\comparison_report.txt"

# Clear file
open(output_file, 'w').close()

# Analyze all three files
analyze_pptx_styles(
    r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\ai ppt 번역기\2. ppt\test_file.pptx",
    "ORIGINAL (Korean)",
    output_file
)

analyze_pptx_styles(
    r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\ai ppt 번역기\2. ppt\test_file_p1-2_en.pptx",
    "OLD TRANSLATION",
    output_file
)

analyze_pptx_styles(
    r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\ai ppt 번역기\2. ppt\test_file_p1-2_en (1).pptx",
    "NEW TRANSLATION (Broken)",
    output_file
)

print(f"Report saved to {output_file}")
