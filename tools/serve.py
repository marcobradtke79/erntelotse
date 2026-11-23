#!/usr/bin/env python3
"""Starts Erntelotse locally for testing (Python 3 standard library only).

    python3 tools/serve.py              serve on http://localhost:8000/
    python3 tools/serve.py 8080         another port
    python3 tools/serve.py --open       also open the app in the browser
    python3 tools/serve.py --sw --open  open with the service worker on (offline/update tests)
    python3 tools/serve.py --lan        reachable from other devices in the network (phone)

Every response carries `Cache-Control: no-store`, so the browser always loads the files
as they are on disk – no hard reload after edits. On localhost the service worker only
runs with ?sw in the address (see js/services/pwa.js); without it, edits show up directly.
"""

import argparse
import functools
import http.server
import socket
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.webmanifest': 'application/manifest+json',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format, *args):
        # only show problems, not every file
        if len(args) > 1 and str(args[1])[:1] in '45':
            super().log_message(format, *args)


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(('192.0.2.1', 9))  # no packet is sent; picks the outgoing interface
            return probe.getsockname()[0]
    except OSError:
        return None


def main():
    parser = argparse.ArgumentParser(description='Serve Erntelotse locally without caching.')
    parser.add_argument('port', nargs='?', type=int, default=8000, help='port (default 8000)')
    parser.add_argument('--open', action='store_true', help='open the app in the browser')
    parser.add_argument('--sw', action='store_true', help='open with the service worker on (?sw)')
    parser.add_argument('--lan', action='store_true', help='listen on all interfaces, e.g. to test on a phone')
    args = parser.parse_args()

    host = '0.0.0.0' if args.lan else '127.0.0.1'
    try:
        server = http.server.ThreadingHTTPServer((host, args.port), functools.partial(Handler, directory=str(ROOT)))
    except OSError as error:
        sys.exit(f'Cannot use port {args.port}: {error.strerror}. Try another one: python3 tools/serve.py {args.port + 1}')

    base = f'http://localhost:{args.port}/'
    app = f'{base}?sw#/dashboard' if args.sw else base
    print(f'Erntelotse runs at   {app}')
    print(f'Tests                {base}tests/')
    print(f'With service worker  {base}?sw#/dashboard')
    if args.lan:
        address = lan_address()
        if address:
            print(f'Other devices        http://{address}:{args.port}/  (no service worker or install: needs https or localhost)')
    print('Stop with Ctrl+C', flush=True)

    if args.open:
        webbrowser.open(app)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
