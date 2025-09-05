import re
import sys
import traceback
import os

# Function to strip all HTML tags from a string
def strip_tags(html_text):
    if not html_text:
        return ""
    # This regex removes any <...> tags
    clean_text = re.sub(r'<[^>]+>', '', html_text)
    return clean_text.strip()

# Function to sanitize filename
def sanitize_filename(filename):
    # 移除 Windows 檔名不允許的字元
    invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
    sanitized = re.sub(invalid_chars, '', filename)
    # 去除前後空白
    sanitized = sanitized.strip()
    # 若清理後為空，則給預設名
    if not sanitized:
        sanitized = "untitled"
    return sanitized

# --- 參數檢查 ---
if len(sys.argv) < 3:
    print("錯誤：請提供要轉換的 HTML 檔案名稱和輸出資料夾。")
    print("用法: python converter_v2.py \"您的檔案名.html\" \"輸出資料夾路徑\"")
    sys.exit(1)

input_filename = sys.argv[1]
output_dir = sys.argv[2]

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

try:
    with open(input_filename, "r", encoding="utf-8") as f:
        html_content = f.read()

    # --- 取得歌手與歌名 ---
    extracted_artist = ""
    extracted_song = ""
    
    opts_match = re.search(r'var opts = \{([\s\S]*?)\};', html_content)
    if opts_match:
        opts_content = opts_match.group(1)
        artist_match = re.search(r'artist:\s*"(.*?)"', opts_content)
        song_match = re.search(r'song:\s*"(.*?)"', opts_content)
        
        if artist_match:
            extracted_artist = artist_match.group(1).strip()
        if song_match:
            extracted_song = song_match.group(1).strip()

    # --- 取得 bpm ---
    bpm_value = ""
    bpm_match = re.search(r'const\s+defaultBpm\s*=\s*"(.*?)";', html_content)
    if bpm_match:
        bpm_value = bpm_match.group(1).strip()

    # --- 決定輸出檔名 ---
    if extracted_song:
        output_filename_base = sanitize_filename(extracted_song) + '.txt'
    else:
        # 若找不到歌名則用原始檔名
        output_filename_base = ".".join(os.path.basename(input_filename).split('.')[:-1]) + '.txt'

    # Construct full output path
    output_filepath = os.path.join(output_dir, output_filename_base)

    output_lines = []
    # --- 標頭處理 ---
    output_lines.append(f"#title: {extracted_song}")
    output_lines.append(f"#artist: {extracted_artist}")
    output_lines.append(f"#tags: ")
    output_lines.append("#key: ")
    output_lines.append(f"#bpm: {bpm_value}")
    capo_match = re.search(r'capo="([+-]?\d+)"', html_content)
    if capo_match:
        capo = int(capo_match.group(1))
        output_lines.append(f"#capo: {-capo}")
    else:
        output_lines.append("#capo: ")
    output_lines.append("")

    # --- 依據 DIV 處理主體 ---
    div_rows = re.findall(r'(<div class=\"row ml-0 mr-0 chord-row\">[\s\S]*?</div>)', html_content, re.DOTALL)
    master_regex = r"<rt>([\s\S]*?)</rt>|<span class=\"col\"[^>]*>([\s\S]*?)</span>"

    for row_html in div_rows:
        line_builder = ""
        current_chord = ""
        
        matches = re.finditer(master_regex, row_html)

        for match in matches:
            chord_html = match.group(1)
            lyric_html = match.group(2)

            if chord_html is not None:
                current_chord = strip_tags(chord_html)
            elif lyric_html is not None:
                lyric_text = strip_tags(lyric_html)
                
                # 檢查是否為 None，空字串要包含，但排除只包含空白字元的字串
                if lyric_text is not None and (lyric_text == "" or lyric_text.strip()):
                    # 如果原本是空字串，代表空的 span 標籤，應該轉換為空格
                    if lyric_text == "":
                        lyric_text = " "
                    
                    if current_chord:
                        line_builder += f"[{current_chord}]{lyric_text}"
                        current_chord = ""
                    else:
                        line_builder += lyric_text
                else:
                    if current_chord:
                        line_builder += f"[{current_chord}]"
                        current_chord = ""
        
        output_lines.append(line_builder)

    while output_lines and not output_lines[-1]:
        output_lines.pop()

    with open(output_filepath, "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(output_lines))
    
    print(f"成功！已將 '{input_filename}' 轉換並儲存為 '{output_filepath}'。")

except FileNotFoundError:
    print(f"錯誤：找不到檔案 '{input_filename}'。請確認檔案名稱是否正確，且檔案與腳本在同一個資料夾中。")
except Exception as e:
    print(f"發生未預期的錯誤: {e}")
    traceback.print_exc()