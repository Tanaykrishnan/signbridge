"""Authenticated loopback-only research service; no uploads, remote calls or public binding."""

import hmac
import json
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from assets import DATA
from engine import CoverageError, Engine


def main():
    engine = Engine()
    lock = threading.Lock()
    key_file = DATA / 'server.key'
    if not key_file.exists():
        with key_file.open('x', encoding='ascii') as target:
            target.write(secrets.token_hex(32))
    token = key_file.read_text(encoding='ascii').strip()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *_args):
            pass  # Never log users' source text or authorization headers.

        def respond(self, status, body):
            raw = json.dumps(body, separators=(',', ':'), allow_nan=False).encode('utf-8')
            try:
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(raw)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass

        def authorized(self):
            return not self.headers.get('Origin') and hmac.compare_digest(
                self.headers.get('Authorization', ''), 'Bearer ' + token)

        def do_GET(self):
            if not self.authorized():
                return self.respond(401, {'error': 'Unauthorized'})
            if self.path != '/health':
                return self.respond(404, {'error': 'Not found'})
            self.respond(200, {'ready': True, 'engine': 'local-sign-vqvae',
                               'vocabularySize': len(engine.labels), 'review': 'unreviewed',
                               'commercialUse': False})

        def do_POST(self):
            if not self.authorized():
                return self.respond(401, {'error': 'Unauthorized'})
            if self.path != '/generate':
                return self.respond(404, {'error': 'Not found'})
            if not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.respond(415, {'error': 'Send application/json'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 32768:
                    return self.respond(413, {'error': 'Invalid request size'})
                request = json.loads(self.rfile.read(size))
                if not isinstance(request, dict) or set(request) != {'sourceText'}:
                    raise ValueError('Expected sourceText only')
                if not lock.acquire(blocking=False):
                    return self.respond(429, {'error': 'The local ISL decoder is busy. Retry shortly.'})
                try:
                    result = engine.generate(request['sourceText'])
                    self.respond(200, result)
                finally:
                    lock.release()
            except CoverageError as error:
                self.respond(422, {'error': str(error), 'code': 'vocabulary-unavailable',
                                   'unsupportedWords': error.words})
            except (ValueError, TypeError, KeyError) as error:
                self.respond(422, {'error': str(error)[:1000], 'code': 'input-unsupported'})
            except Exception:
                self.respond(500, {'error': 'Local ISL inference failed. No substitute motion was produced.'})

    server = ThreadingHTTPServer(('127.0.0.1', 8082), Handler)
    print(f'Local ISL research engine ready: 127.0.0.1:8082; {len(engine.labels)} sign classes; unreviewed.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
