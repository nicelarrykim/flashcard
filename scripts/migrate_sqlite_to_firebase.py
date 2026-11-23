#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/migrate_sqlite_to_firebase.py
기존 SQLite (vocaquest_server.db)의 프로필 및 2,475건 최신 단어 성취도,
그리고 기본 공용 단어장을 Firebase Cloud Firestore로 직접 이관(Migration)하는 스크립트.
"""

import os
import sys
import sqlite3
import json
import re
import urllib.request
import urllib.error

PROJECT_ID = "vocaquest-web"
API_KEY = "AIzaSyBS1a2Z-O8hnNUfZNMHwO0TGt-2AzXpcYE"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "vocaquest_server.db")

def to_firestore_value(val):
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(x) for x in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    return {"stringValue": str(val)}

def to_firestore_doc(data_dict):
    return {"fields": {k: to_firestore_value(v) for k, v in data_dict.items()}}

def patch_firestore_doc(collection, doc_id, data_dict):
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{collection}/{doc_id}?key={API_KEY}"
    doc_payload = to_firestore_doc(data_dict)
    body = json.dumps(doc_payload, ensure_ascii=False).encode('utf-8')
    
    req = urllib.request.Request(url, data=body, method='PATCH')
    req.add_header('Content-Type', 'application/json; charset=utf-8')
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return True, resp.status
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        return False, f"HTTP {e.code}: {err_msg}"
    except Exception as e:
        return False, str(e)

def load_json_deck(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[Error] SQLite DB 파일을 찾을 수 없습니다: {DB_PATH}")
        return

    print("=" * 60)
    print("🚀 VocaQuest SQLite ➔ Firebase Firestore 데이터 마이그레이션")
    print(f"대상 프로젝트: {PROJECT_ID}")
    print(f"데이터베이스 파일: {DB_PATH}")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. 프로필 마이그레이션
    cur.execute("SELECT id, name, description, avatar, created_at, updated_at FROM profiles")
    profiles = cur.fetchall()
    print(f"\n[1/3] 프로필 마이그레이션 중... (총 {len(profiles)}개)")

    for row in profiles:
        prof_id, name, desc, avatar, created_at, updated_at = row
        prof_data = {
            "id": prof_id,
            "name": name or "학습자",
            "description": desc or "",
            "avatar": avatar or "🛡️",
            "createdAt": created_at or 0,
            "updatedAt": updated_at or 0
        }
        ok, res = patch_firestore_doc("profiles", prof_id, prof_data)
        if ok:
            print(f"  ✅ 프로필 '{name}' ({prof_id}) ➔ 업로드 성공")
        else:
            print(f"  ❌ 프로필 '{name}' ({prof_id}) ➔ 실패: {res}")

    # 2. 프로필별 성취도(profile_data) 마이그레이션
    cur.execute("SELECT profile_id, word_id, memorized, wrong_count, mastery_json, updated_at FROM profile_data")
    rows = cur.fetchall()
    print(f"\n[2/3] 프로필별 단어 성취도 마이그레이션 중... (총 {len(rows)}건 레코드)")

    # 프로필별로 그룹화
    grouped = {}
    for pid, wid, mem, wrong, m_json, upd in rows:
        if pid not in grouped:
            grouped[pid] = {}
        
        mastery_obj = None
        if m_json:
            try:
                mastery_obj = json.loads(m_json)
            except Exception:
                pass
        
        grouped[pid][wid] = {
            "memorized": bool(mem),
            "wrongCount": int(wrong or 0),
            "mastery": mastery_obj,
            "updatedAt": int(upd or 0)
        }

    for pid, words_dict in grouped.items():
        print(f"  🔄 프로필({pid}) 단어 {len(words_dict)}개 성과 업로드 중...")
        ok, res = patch_firestore_doc("profileData", pid, words_dict)
        if ok:
            print(f"  ✅ 프로필({pid}) 성과 업로드 완료!")
        else:
            print(f"  ❌ 프로필({pid}) 성과 업로드 실패: {res}")

    conn.close()

    # 3. 공용 단어장(Public Decks) 마이그레이션
    print(f"\n[3/3] 기본 공용 단어장(Public Decks) 마이그레이션...")
    json_path = os.path.join(BASE_DIR, "센클보카킹2026하반기.json")
    cenkle_data = load_json_deck(json_path)
    if cenkle_data and isinstance(cenkle_data, list):
        cenkle_deck = {
            "id": "deck_cenkle_voca_king_2026",
            "name": "센클보카킹 2026",
            "description": "센클보카킹 2026 하반기 공식 영단어장 (공용)",
            "isPublic": True,
            "profileId": None,
            "imagePosition": "bottom",
            "words": cenkle_data,
            "createdAt": 1795300000000,
            "updatedAt": 1795400000000
        }
        ok, res = patch_firestore_doc("decks", cenkle_deck["id"], cenkle_deck)
        if ok:
            print(f"  ✅ 공용 단어장 '{cenkle_deck['name']}' ({len(cenkle_data)}단어) ➔ 업로드 성공")
        else:
            print(f"  ❌ 공용 단어장 업로드 실패: {res}")

    print("\n🎉 모든 데이터 마이그레이션 작업이 완료되었습니다!")

if __name__ == "__main__":
    migrate()
