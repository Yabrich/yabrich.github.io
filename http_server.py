#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Change directory to the one to serve"
#os.chdir(r"C:\Users\Yael\Documents\Test_old\yabrich.github.io-27183b33406336bce0d49558ab09077ef99096a1")

PORT = 8000
HOST = ""

handler_class = SimpleHTTPRequestHandler
server = HTTPServer((HOST, PORT), handler_class)

print(f"➡️  Serveur démarré sur http://localhost:{PORT}")
print("   (appuyez sur Ctrl+C pour arrêter)")
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\n⏹️  Arrêt du serveur.")
    server.server_close()
