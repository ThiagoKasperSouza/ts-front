import "./styles.css"
import htmlContent from "./index.html?raw"

class RegisterApp {
  private apiBaseUrl: string = "http://localhost:8080";
  private form!: HTMLFormElement;
  private nomeInput!: HTMLInputElement;
  private emailInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;

  constructor() {
    this.init();
  }

  private init(): void {
    if (!this.bindElements()) return;
    this.attachEvents();
  }

  private bindElements(): boolean {
    this.form = document.getElementById("loginForm") as HTMLFormElement;
    this.nomeInput = document.getElementById("nome") as HTMLInputElement;
    this.emailInput = document.getElementById("email") as HTMLInputElement;
    this.passwordInput = document.getElementById("password") as HTMLInputElement;

    const elements = [
      { name: "loginForm", el: this.form },
      { name: "nome", el: this.nomeInput },
      { name: "email", el: this.emailInput },
      { name: "password", el: this.passwordInput }
    ];

    const missing = elements.filter(item => !item.el);
    if (missing.length > 0) {
      console.error("IDs não encontrados no HTML:", missing.map(m => m.name).join(", "));
      return false;
    }

    return true;
  }

  private attachEvents(): void {
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleRegister();
    });
  }

  private async handleRegister(): Promise<void> {
    const nome = this.nomeInput.value.trim();
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    // Validações básicas no front-end
    if (!nome || !email || !password) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      alert("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nome, email, password }),
        credentials: "include"
      });

      if (!response.ok) {
        let errorMsg = `Erro HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.message || errData.error || errorMsg;
        } catch (_) {
          // Se o corpo não for JSON, mantém a mensagem padrão
        }
        throw new Error(errorMsg);
      }

      alert("Conta criada com sucesso! Redirecionando...");
      
      // Redireciona para a página inicial ou de login após o cadastro
      setTimeout(() => {
        window.location.href = "/login"; 
      }, 1000);

    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      alert(`Erro ao cadastrar: ${err.message}`);
    }
  }
}

export function getRegisterPage(): string {
  const checkElementAndInit = () => {
    if (document.getElementById("loginForm")) {
      new RegisterApp();
    } else {
      requestAnimationFrame(checkElementAndInit);
    }
  };

  requestAnimationFrame(checkElementAndInit);

  return htmlContent;
}