// ============================================================
//  CATEA — firebase-config.js
//  Inicialização do Firebase + exportação dos serviços
// ============================================================
//
//  ⚠️  SUBSTITUA os valores abaixo pelos do seu projeto Firebase.
//  Como obter: Firebase Console → Configurações do projeto → "Seus apps" → SDK
//
// ============================================================

import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }              from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }         from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics }         from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// ── Configuração do projeto ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCKSoEYMs8xcTgsq_NTc3RBCppOnv59BIA",
  authDomain: "tccfoxytcc.firebaseapp.com",
  projectId: "tccfoxytcc",
  storageBucket: "tccfoxytcc.firebasestorage.app",
  messagingSenderId: "977757705334",
  appId: "1:977757705334:web:5ee69c747377161eb5fb57"
};

// ── Inicialização ────────────────────────────────────────────
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const analytics = getAnalytics(app);             // opcional

// Exporta para uso em app.js
export { app, auth, db, analytics };
