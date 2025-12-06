import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Check if already logged in
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        window.location.href = 'dashboard.html';
    }
});

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btnText = document.querySelector('.btn-text');
        const btnLoader = document.querySelector('.btn-loader');
        const errorMessage = document.getElementById('errorMessage');

        // Show loading
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        errorMessage.style.display = 'none';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error('Login error:', error);
            let message = 'خطأ في تسجيل الدخول';

            switch (error.code) {
                case 'auth/invalid-email':
                    message = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/user-not-found':
                    message = 'المستخدم غير موجود';
                    break;
                case 'auth/wrong-password':
                    message = 'كلمة المرور غير صحيحة';
                    break;
                case 'auth/invalid-credential':
                    message = 'بيانات الدخول غير صحيحة';
                    break;
                default:
                    message = error.message;
            }

            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } finally {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    });
}

export { auth };
