# This program will read a program file, convert it to a long json string.
# Json String can be copied and pasted into the contents file in the web template.
# Converted String is automatically copied to clipboard for convenience.
# Install pyperclip module to copy the result to clipboard automatically
# pip install pyperclip

# A line starting with -- is ignored: -- marks a comment.
# Anything between /" and "/ will be treated as a block and will be converted to a single line, with all newlines replaced by a space.

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
    filename = input("Enter directory of the file to convert (default: to_json.txt): ").strip()
    if not filename:
        filename = "to_json.txt"
    try:
        result = file_to_single_string(filename=filename)
        pyperclip.copy(result)
        print(f"Successfully converted {filename} to a json single string and copied to clipboard.")
    except FileNotFoundError:
        print(f"Error: {filename} was not found.")
    except Exception as e:
        print(f"Error: {e}")