import "./style.css"
import htmlContent from "./index.html?raw"

async function handleLogin(event: Event): Promise<void> {
  event.preventDefault();

  const emailInput = document.getElementById('email') as HTMLInputElement | null;
  const passwordInput = document.getElementById('password') as HTMLInputElement | null;

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch('http://localhost:8080/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials:'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      alert(errorData?.message || 'E-mail ou senha incorretos.');
      return;
    }

    const data = await response.json();
    console.log('Resposta do servidor:', data);

    if (data.access_token) {
      localStorage.setItem('authToken', data.access_token);
    }

    alert('Login realizado com sucesso!');
    window.location.href = '/'

  } catch (error) {
    console.error('Erro na requisição:', error);
    alert('Não foi possível conectar ao servidor. Verifique sua conexão.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin(e);
        });
    } else {
        console.error('Elemento #loginForm ainda não foi encontrado no DOM!');
    }
});

export function getLoginPage(): string {
  return htmlContent;
}

