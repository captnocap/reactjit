#!/usr/bin/env python3
"""Stupid simple tkinter calculator for AppEmbed demo."""
import tkinter as tk

root = tk.Tk()
root.title("Calculator")
root.geometry("300x400")
root.configure(bg="#1e1e2e")

expr = ""
display_var = tk.StringVar(value="0")

frame_display = tk.Frame(root, bg="#1e1e2e", pady=10)
frame_display.pack(fill=tk.X, padx=10)

label = tk.Label(frame_display, textvariable=display_var, font=("monospace", 28),
                 bg="#313244", fg="#cdd6f4", anchor="e", padx=15, pady=10)
label.pack(fill=tk.X)

frame_buttons = tk.Frame(root, bg="#1e1e2e")
frame_buttons.pack(expand=True, fill=tk.BOTH, padx=10, pady=10)

def press(val):
    global expr
    expr += str(val)
    display_var.set(expr)

def calculate():
    global expr
    try:
        result = str(eval(expr))
        display_var.set(result)
        expr = result
    except:
        display_var.set("Error")
        expr = ""

def clear():
    global expr
    expr = ""
    display_var.set("0")

buttons = [
    ("C", 0, 0, "#f38ba8"), ("/", 0, 1, "#fab387"), ("*", 0, 2, "#fab387"), ("-", 0, 3, "#fab387"),
    ("7", 1, 0, "#45475a"), ("8", 1, 1, "#45475a"), ("9", 1, 2, "#45475a"), ("+", 1, 3, "#fab387"),
    ("4", 2, 0, "#45475a"), ("5", 2, 1, "#45475a"), ("6", 2, 2, "#45475a"), ("=", 2, 3, "#a6e3a1"),
    ("1", 3, 0, "#45475a"), ("2", 3, 1, "#45475a"), ("3", 3, 2, "#45475a"), ("0", 3, 3, "#45475a"),
]

for (text, row, col, bg) in buttons:
    cmd = clear if text == "C" else (calculate if text == "=" else lambda t=text: press(t))
    btn = tk.Button(frame_buttons, text=text, font=("monospace", 18), bg=bg, fg="#cdd6f4",
                    activebackground="#585b70", activeforeground="#cdd6f4",
                    relief=tk.FLAT, borderwidth=0, command=cmd)
    btn.grid(row=row, column=col, sticky="nsew", padx=3, pady=3)

for i in range(4):
    frame_buttons.grid_rowconfigure(i, weight=1)
    frame_buttons.grid_columnconfigure(i, weight=1)

root.mainloop()
