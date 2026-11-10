// configuração do app web do Firebase (Console > Configurações do projeto > Seus apps).
// Esses valores não são segredo: quem protege os dados são as regras do Firestore (firestore.rules).
// Com apiKey vazia a nuvem fica desligada e tudo continua só neste navegador.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
