# Turns a text file into one JSON string (newlines become \n) to paste into a
# content file, and copies it to the clipboard (needs: pip install pyperclip).
# Lines starting with -- are comments and are dropped. Text between /" and "/
# is one block: its newlines become spaces.

import re
import pyperclip


def file_to_single_string(filename="to_json.txt"):
    with open(filename, "r", encoding="utf-8") as file:
        text = file.read()

    lines = text.splitlines()
    filtered_lines = [
        line for line in lines
        if not line.lstrip().startswith("--")
    ]
    text = "\n".join(filtered_lines)

    def collapse_block(match):
        content = match.group(1)
        content = " ".join(content.splitlines())
        return f'/"{content}"/'

    text = re.sub(r'/"(.*?)"/', collapse_block, text, flags=re.DOTALL)

    return text.replace("\n", "\\n")


if __name__ == "__main__":
    filename = input("Enter the path of the file to convert (default: to_json.txt): ").strip()
    if not filename:
        filename = "to_json.txt"
    try:
        result = file_to_single_string(filename=filename)
        pyperclip.copy(result)
        print(f"Converted {filename} to one JSON string and copied it to the clipboard.")
    except FileNotFoundError:
        print(f"Error: {filename} was not found.")
    except Exception as e:
        print(f"Error: {e}")