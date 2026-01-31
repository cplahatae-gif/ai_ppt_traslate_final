import zipfile
import re
import sys

def inspect_pptx_raw(ppt_path, output_file):
    """Extract raw XML from PPTX to find highlight structure"""
    with open(output_file, 'w', encoding='utf-8') as f:
        with zipfile.ZipFile(ppt_path, 'r') as z:
            # Read slide1.xml
            for name in z.namelist():
                if 'slide1.xml' in name:
                    content = z.read(name).decode('utf-8')
                    
                    # Find all rPr elements with their content
                    # More flexible pattern
                    pattern = r'<a:rPr[^/]*?(?:/>|>.*?</a:rPr>)'
                    matches = re.findall(pattern, content, re.DOTALL)
                    
                    f.write(f"Found {len(matches)} rPr elements\n\n")
                    
                    # Show all unique patterns
                    for i, match in enumerate(matches):
                        if 'highlight' in match.lower() or 'FFFF' in match:
                            f.write(f"=== POTENTIAL HIGHLIGHT {i} ===\n")
                            f.write(match + "\n\n")
                    
                    # Also search for highlight directly
                    if 'highlight' in content.lower():
                        f.write("Found 'highlight' keyword in content\n")
                        idx = content.lower().find('highlight')
                        f.write(content[max(0,idx-100):idx+200] + "\n")
                    
                    # Search for yellow color FFFF00
                    if 'FFFF00' in content:
                        f.write("\nFound FFFF00 (yellow) in content!\n")
                        for m in re.finditer('FFFF00', content):
                            start = max(0, m.start() - 200)
                            end = min(len(content), m.end() + 200)
                            f.write(f"\nContext:\n{content[start:end]}\n")
                            f.write("-"*50 + "\n")

ppt_path = r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\ai ppt 번역기\2. ppt\test_file.pptx"
output_file = r"c:\Users\nomus\Desktop\구글 동기화\안티그래비티\테스트\project\highlight_analysis.txt"
inspect_pptx_raw(ppt_path, output_file)
print(f"Output saved to {output_file}")
