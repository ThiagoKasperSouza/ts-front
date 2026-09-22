import './style.css' // css geral
import { getHomePage } from './pages/home/home.ts'
import { getLoginPage } from './pages/login/login.ts'
import { getRegisterPage } from './pages/register/register.ts'

// 1. Define que cada rota deve ser uma função que retorna uma string HTML
type PageRenderFn = () => string;

// 2. Mapeamento das rotas (HashMap)
const routes: Record<string, PageRenderFn> = {
  '/': getHomePage,
  '/login': getLoginPage,
  '/register': getRegisterPage,
};

// 3. Renderizador da página 404
const getNotFoundPage: PageRenderFn = () => '<h1>Erro 404: Página não encontrada</h1>';

function renderPage(): string {
  const path: string = window.location.pathname;

  // Busca a função de renderização no HashMap; se não existir, usa a de 404
  const renderFn: PageRenderFn = routes[path] ?? getNotFoundPage;

  return renderFn();
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = renderPage();