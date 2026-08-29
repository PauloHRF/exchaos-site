import { defineConfig } from 'vite';

/**
 * `base: './'` deixa todos os caminhos relativos à página.
 *
 * É o que faz o jogo funcionar no GitHub Pages, que serve o site num
 * subcaminho (`usuario.github.io/repositorio/`). Com o padrão `/`, o navegador
 * buscaria os assets e os JSON na raiz do domínio e receberia 404 em tudo —
 * tela branca, sem erro visível.
 *
 * Quem lê um JSON ou monta uma URL de imagem no código precisa usar
 * `import.meta.env.BASE_URL` pelo mesmo motivo.
 */
export default defineConfig({
  base: './',
});
