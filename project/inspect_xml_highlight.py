import zipfile
import xml.dom.minidom
import os

def inspect_ppt_xml(pptx_path, search_text="Purpose"):
    print(f"Inspecting {pptx_path} for '{search_text}'...")
    
    with zipfile.ZipFile(pptx_path, 'r') as z:
        # Iterate over all slide XMLs
        for filename in z.namelist():
            if filename.startswith('ppt/slides/slide') and filename.endswith('.xml'):
                xml_content = z.read(filename).decode('utf-8')
                
                if search_text in xml_content:
                    print(f"Found '{search_text}' in {filename}")
                    
                    # Parse XML to find the rPr surrounding the text
                    dom = xml.dom.minidom.parseString(xml_content)
                    runs = dom.getElementsByTagName('a:r')
                    
                    for run in runs:
                        t = run.getElementsByTagName('a:t')
                        if t and search_text in t[0].firstChild.nodeValue:
                            print("\n--- Found Run XML ---")
                            print(run.toprettyxml())
                            
                            # Check highlight specifically
                            rPr = run.getElementsByTagName('a:rPr')
                            if rPr:
                                highlight = rPr[0].getElementsByTagName('a:highlight')
                                if highlight:
                                    print("!!! Highlight Tag Found !!!")
                                    print(highlight[0].toprettyxml())
                                else:
                                    print("No <a:highlight> tag in this run.")

if __name__ == "__main__":
    base_path = r"c:/Users/nomus/Desktop/구글 동기화/안티그래비티/테스트/project/ai ppt 번역기/2. ppt/"
    inspect_ppt_xml(os.path.join(base_path, "test_file.pptx"), "Purpose")
