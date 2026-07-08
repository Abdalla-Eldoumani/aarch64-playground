# This is a python helper script
# This program will read a program file, convert it to a long json string.
# Json String can be copied and pasted into the contents file in the web template
# Install pyperclip module to copy the result to clipboard automatically
# pip install pyperclip

import pyperclip

def file_to_single_string(filename="toJson.txt"):
    with open(filename, "r", encoding="utf-8") as file:
        return "\\n".join(line.rstrip("\n") for line in file)


if __name__ == "__main__":
    filename = input("Enter directory of the file to convert (default: toJson.txt): ").strip()
    if not filename:
        filename = "web/helper-tools/Json String Converter/toJson.txt"
    try:
        result = file_to_single_string(filename=filename)
        pyperclip.copy(result)
        print(f"Successfully converted {filename} to a json single string and copied to clipboard.")
    except FileNotFoundError:
        print(f"Error: {filename} was not found.")
    except Exception as e:
        print(f"Error: {e}")