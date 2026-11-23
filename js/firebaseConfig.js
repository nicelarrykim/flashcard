// js/firebaseConfig.js
// Firebase 초기화 및 설정 모듈
// GitHub Pages 정적 웹 환경에서 CDN 기반 ES Module로 동작합니다.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: "AIzaSyBS1a2Z-O8hnNUfZNMHwO0TGt-2AzXpcYE",
  authDomain: "vocaquest-web.firebaseapp.com",
  projectId: "vocaquest-web",
  storageBucket: "vocaquest-web.firebasestorage.app",
  messagingSenderId: "143592444747",
  appId: "1:143592444747:web:1ead75da14fcd943e58ece"
};

// Firebase 초기화 상태 체크
export const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "YOUR_API_KEY");
};

let app = null;
let db = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    
    // 멀티 탭 IndexedDB 캐시 지속성(Multi-tab Persistence) 활성화
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log('[Firebase] Multi-tab Firestore persistence enabled');
    } catch (cacheErr) {
      console.warn('[Firebase] Multi-tab persistence fallback to default Firestore:', cacheErr);
      db = getFirestore(app);
    }
  } catch (err) {
    console.error('[Firebase] Initialization error:', err);
  }
}

export { app, db };
