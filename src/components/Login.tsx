import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <button 
        onClick={handleLogin}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        Entrar com Google
      </button>
    </div>
  );
}
