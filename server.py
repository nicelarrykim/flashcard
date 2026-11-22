#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VocaQuest 백엔드 서버 (server.py)
- SQLite 기반 프로필 및 학습 성취도 영구 저장
- 다중 기기(PC, 스마트폰, 태블릿 등) 간 실시간 동기화 REST API
- 웹앱 정적 파일 서빙 (CORS 지원)
- 파이썬 3 표준 라이브러리만 사용 (추가 pip 패키지 설치 불필요)
"""

import http.server
import socketserver
import socket
import sqlite3
import json
import os
import sys
import time
import mimetypes
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'vocaquest_server.db')

def get_local_ips():
    """사용 가능한 로컬 IP 주소 목록 반환 (다른 기기 접속용)"""
    ips = []
    try:
        # 외부 통신 시도(실제 패킷 전송 없음)를 통해 대표 IP 확인
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(('8.8.8.8', 80))
        primary_ip = s.getsockname()[0]
        s.close()
        ips.append(primary_ip)
    except Exception:
        pass
    
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            ip = info[4][0]
            if ip not in ips and not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    return ips

def init_db():
    """SQLite 데이터베이스 및 테이블 초기화"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # 1. 사용자 프로필 테이블
    cur.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            avatar TEXT DEFAULT '🛡️',
            created_at INTEGER,
            updated_at INTEGER
        )
    ''')
    
    # 2. 사용자별 단어 성취도 테이블
    cur.execute('''
        CREATE TABLE IF NOT EXISTS profile_data (
            profile_id TEXT NOT NULL,
            word_id TEXT NOT NULL,
            memorized INTEGER DEFAULT 0,
            wrong_count INTEGER DEFAULT 0,
            mastery_json TEXT,
            updated_at INTEGER,
            PRIMARY KEY (profile_id, word_id)
        )
    ''')

    # 기본 프로필이 없으면 생성
    cur.execute('SELECT COUNT(*) FROM profiles')
    if cur.fetchone()[0] == 0:
        now = int(time.time() * 1000)
        cur.execute('''
            INSERT INTO profiles (id, name, description, avatar, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('prof_default', '기본 학습자', '메인 학습 프로필', '🛡️', now, now))
    
    conn.commit()
    conn.close()

class VocaQuestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # 모든 요청에 대해 CORS 및 캐시 제어 헤더 추가
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length).decode('utf-8')
                return json.loads(raw_data)
        except Exception as e:
            print(f"[Error] Failed to read JSON body: {e}")
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. 서버 상태 API
        if path == '/api/status':
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('SELECT COUNT(*) FROM profiles')
            prof_count = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM profile_data')
            record_count = cur.fetchone()[0]
            conn.close()

            self.send_json({
                'status': 'online',
                'server': 'VocaQuest Sync Server',
                'profilesCount': prof_count,
                'recordsCount': record_count,
                'ips': get_local_ips(),
                'port': PORT
            })
            return

        # 2. 프로필 목록 조회 API: GET /api/profiles
        if path == '/api/profiles':
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT id, name, description, avatar, created_at AS createdAt, updated_at AS updatedAt FROM profiles ORDER BY created_at ASC')
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            self.send_json(rows)
            return

        # 3. 특정 프로필의 성취도 데이터 조회 API: GET /api/profiles/<id>/data
        if path.startswith('/api/profiles/') and path.endswith('/data'):
            parts = path.strip('/').split('/')
            if len(parts) == 4:
                profile_id = parts[2]
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute('SELECT word_id, memorized, wrong_count, mastery_json FROM profile_data WHERE profile_id = ?', (profile_id,))
                result = {}
                for row in cur.fetchall():
                    mastery = None
                    if row['mastery_json']:
                        try:
                            mastery = json.loads(row['mastery_json'])
                        except Exception:
                            pass
                    result[row['word_id']] = {
                        'memorized': bool(row['memorized']),
                        'wrongCount': int(row['wrong_count']),
                        'mastery': mastery
                    }
                conn.close()
                self.send_json(result)
                return

        # 4. 전체 동기화 번들 조회 API: GET /api/sync
        if path == '/api/sync':
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT id, name, description, avatar, created_at AS createdAt, updated_at AS updatedAt FROM profiles')
            profiles = [dict(r) for r in cur.fetchall()]
            
            cur.execute('SELECT profile_id, word_id, memorized, wrong_count, mastery_json FROM profile_data')
            all_data = {}
            for row in cur.fetchall():
                pid = row['profile_id']
                if pid not in all_data:
                    all_data[pid] = {}
                mastery = None
                if row['mastery_json']:
                    try:
                        mastery = json.loads(row['mastery_json'])
                    except Exception:
                        pass
                all_data[pid][row['word_id']] = {
                    'memorized': bool(row['memorized']),
                    'wrongCount': int(row['wrong_count']),
                    'mastery': mastery
                }
            conn.close()

            self.send_json({
                'profiles': profiles,
                'profileData': all_data
            })
            return

        # 일반 정적 파일 서빙
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        # 1. 프로필 목록 일괄/단일 저장: POST /api/profiles
        if path == '/api/profiles':
            if not body:
                self.send_json({'error': 'Invalid JSON body'}, 400)
                return

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()

            # 배열 형태(전체 프로필 목록 동기화)이거나 단일 객체 지원
            profiles_to_save = body if isinstance(body, list) else [body]
            now = int(time.time() * 1000)

            for p in profiles_to_save:
                pid = p.get('id')
                name = p.get('name', '학습자')
                desc = p.get('description', '')
                avatar = p.get('avatar', '🛡️')
                created_at = p.get('createdAt') or now
                updated_at = p.get('updatedAt') or now
                if pid:
                    cur.execute('''
                        INSERT INTO profiles (id, name, description, avatar, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            description = excluded.description,
                            avatar = excluded.avatar,
                            updated_at = excluded.updated_at
                    ''', (pid, name, desc, avatar, created_at, updated_at))
            conn.commit()
            conn.close()
            self.send_json({'success': True, 'count': len(profiles_to_save)})
            return

        # 2. 특정 프로필의 성취도 데이터 저장: POST /api/profiles/<id>/data
        if path.startswith('/api/profiles/') and path.endswith('/data'):
            parts = path.strip('/').split('/')
            if len(parts) == 4:
                profile_id = parts[2]
                if not isinstance(body, dict):
                    self.send_json({'error': 'Body must be a key-value dictionary of words'}, 400)
                    return

                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                now = int(time.time() * 1000)

                for word_id, item in body.items():
                    if not isinstance(item, dict):
                        continue
                    memorized = 1 if item.get('memorized') else 0
                    wrong_count = int(item.get('wrongCount', 0))
                    mastery = item.get('mastery')
                    mastery_json = json.dumps(mastery, ensure_ascii=False) if mastery else None

                    cur.execute('''
                        INSERT INTO profile_data (profile_id, word_id, memorized, wrong_count, mastery_json, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(profile_id, word_id) DO UPDATE SET
                            memorized = excluded.memorized,
                            wrong_count = excluded.wrong_count,
                            mastery_json = excluded.mastery_json,
                            updated_at = excluded.updated_at
                    ''', (profile_id, word_id, memorized, wrong_count, mastery_json, now))

                conn.commit()
                conn.close()
                self.send_json({'success': True, 'savedWords': len(body)})
                return

        # 3. 전체 동기화 POST API: POST /api/sync
        if path == '/api/sync':
            if not body or not isinstance(body, dict):
                self.send_json({'error': 'Invalid payload'}, 400)
                return

            profiles = body.get('profiles', [])
            profile_data_map = body.get('profileData', {})

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            now = int(time.time() * 1000)

            for p in profiles:
                pid = p.get('id')
                if pid:
                    cur.execute('''
                        INSERT INTO profiles (id, name, description, avatar, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            description = excluded.description,
                            avatar = excluded.avatar,
                            updated_at = excluded.updated_at
                    ''', (pid, p.get('name', '학습자'), p.get('description', ''), p.get('avatar', '🛡️'), p.get('createdAt') or now, now))

            for pid, words in profile_data_map.items():
                if isinstance(words, dict):
                    for word_id, item in words.items():
                        if isinstance(item, dict):
                            memorized = 1 if item.get('memorized') else 0
                            wrong_count = int(item.get('wrongCount', 0))
                            mastery = item.get('mastery')
                            mastery_json = json.dumps(mastery, ensure_ascii=False) if mastery else None
                            cur.execute('''
                                INSERT INTO profile_data (profile_id, word_id, memorized, wrong_count, mastery_json, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?)
                                ON CONFLICT(profile_id, word_id) DO UPDATE SET
                                    memorized = excluded.memorized,
                                    wrong_count = excluded.wrong_count,
                                    mastery_json = excluded.mastery_json,
                                    updated_at = excluded.updated_at
                            ''', (pid, word_id, memorized, wrong_count, mastery_json, now))

            conn.commit()
            conn.close()
            self.send_json({'success': True, 'message': 'Full sync completed successfully'})
            return

        self.send_json({'error': 'Endpoint not found'}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 프로필 삭제 API: DELETE /api/profiles/<id>
        if path.startswith('/api/profiles/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3:
                profile_id = parts[2]
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
                cur.execute('DELETE FROM profile_data WHERE profile_id = ?', (profile_id,))
                conn.commit()
                conn.close()
                self.send_json({'success': True, 'deletedId': profile_id})
                return

        self.send_json({'error': 'Endpoint not found'}, 404)

    def log_message(self, format, *args):
        # 정적 파일 요청 로그는 간소화, API 요청 로그만 명확히 출력
        if '/api/' in (args[0] if len(args) > 0 else ''):
            sys.stdout.write(f"[API] {self.address_string()} - {format % args}\n")
            sys.stdout.flush()

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def main():
    init_db()
    server_address = ('0.0.0.0', PORT)
    httpd = ThreadingHTTPServer(server_address, VocaQuestHandler)

    ips = get_local_ips()
    print("=" * 65)
    print(f"🚀 VocaQuest 백엔드 & 동기화 서버가 실행되었습니다!")
    print(f"📌 로컬 브라우저 접속: http://localhost:{PORT}")
    if ips:
        print(f"📱 스마트폰/태블릿/다른 PC 접속:")
        for ip in ips:
            print(f"   👉 http://{ip}:{PORT}")
    print(f"💾 데이터베이스: {DB_PATH} (SQLite 영구 보존)")
    print(f"🛡️  다중 기기 프로필 & 성취도 실시간 동기화 지원")
    print("=" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        httpd.server_close()

if __name__ == '__main__':
    main()
