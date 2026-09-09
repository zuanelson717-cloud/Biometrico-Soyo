import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, 'ai-studio-biometrictimetra-8b2d46d9-0886-4fef-ab5a-df5d0d25a6b5');

export const auth = getAuth(app);
export const storage = getStorage(app);
