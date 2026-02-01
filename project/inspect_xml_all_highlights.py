import zipfile
import xml.dom.minidom
import os

def inspect_all_highlights(pptx_path):
    print(f"Inspecting {pptx_path}")
    with open("highlight_dump.txt", "w", encoding="utf-8") as f:
        with zipfile.ZipFile(pptx_path, 'r') as z:
            for filename in z.namelist():
                if filename.startswith('ppt/slides/slide') and filename.endswith('.xml'):
                    xml_content = z.read(filename).decode('utf-8')
                    
                    dom = xml.dom.minidom.parseString(xml_content)
                    runs = dom.getElementsByTagName('a:r')
                    
                    for run in runs:
                        rPr = run.getElementsByTagName('a:rPr')
                        if rPr:
                            highlight = rPr[0].getElementsByTagName('a:highlight')
                            if highlight:
                                t = run.getElementsByTagName('a:t')
                                text_val = t[0].firstChild.nodeValue if t and t[0].firstChild else "(No Text)"
                                f.write(f"\n[Found Highlight in {filename}] Text: '{text_val}'\n")
                                f.write(highlight[0].toprettyxml())
    
    print("Dumped to highlight_dump.txt")

if __name__ == "__main__":
    base_path = r"c:/Users/nomus/Desktop/구글 동기화/안티그래비티/테스트/project/ai ppt 번역기/2. ppt/"
    # Check Original File
    inspect_all_highlights(os.path.join(base_path, "test_file_p1-2_en (6).pptx"))
