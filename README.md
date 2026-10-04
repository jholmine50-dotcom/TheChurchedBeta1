# Churched

PREACH FLOW — apresentação com espelho PC ↔ celular (o PC toca o áudio, o celular controla).

## Como usar

1. **PC:** abra `https://jholmine50-dotcom.github.io/TheChurchedBeta1/palco.html` (ou o arquivo `PREACH_FLOW_V10_ESPELHO.html`) e clique em **ESPELHAR** — anote o **código da sala**.
2. **Celular:** abra o site abaixo, digite o código (**6 caracteres**) e toque em **ENTRAR NA SALA**. Se o código estiver errado ou não houver palco aberto com ele, o celular avisa (**Sala não encontrada**) e pede o código de novo.
3. No celular aparece o CONTROLE (TOCAR, STOP, intensidade, fala, faixas); o PC executa e o áudio sai dele.
4. **Slides do Canva:** cole o link de qualquer apresentação em **APRESENTAÇÃO CANVA** (no PC ou no celular). Ela abre em **tela cheia no palco** e no **1/4 superior no controle**, com as setinhas **← →** para passar os slides dos dois lados.
5. **Laser:** no celular, um **trackpad** ocupa 1/5 inferior da tela — passe o dedo e um ponteiro vermelho aparece no slide e no palco (some sozinho após 5 s parado); no PC, basta mover o mouse sobre o slide. No controle do PC, o botão **MAX** deixa o slide em tela inteira.

## Versões do palco

- **v3 (atual) — `palco.html`**: mesma estrutura da v2, com visual **Liquid Glass** (inspirado no design da Apple):
  - vidro só nos controles e na navegação (barra de abas, biblioteca, botões, barra do slide, setas); conteúdo em cartões escuros legíveis;
  - fundo ambiente que muda de cor com a **intensidade** (frio no SUAVE, quente no CLÍMAX), estático para não pesar no PC;
  - o celular (`espelho/`) e a entrada (`index.html`) ganharam o mesmo visual;
  - quem usa "reduzir transparência" no sistema recebe superfícies sólidas.
- **v2 (anterior) — `v2/palco.html`** (também no branch `v2`): o palco com **abas no estilo do Chrome**:
  - **Fundo** — a música de fundo (biblioteca, tocar/stop/fade, linha do tempo, intensidade, fala). A aba mostra um equalizer quando está tocando e a intensidade atual.
  - **Slide** — a apresentação do Canva: barra com link + ABRIR, ‹ slide N ›, **TELA CHEIA** (para projetar; `Esc` sai) e FECHAR. O slide fica em 16:9, alinhado com o controle do celular, então o laser cai no lugar certo.
  - Trocar de aba **não para a música**. Quando chega uma apresentação nova (do PC ou do celular), o palco vai sozinho para a aba Slide.
  - Teclas: `←` `→` / `PgUp` `PgDn` passam slides (funciona com passador), `Alt+1` / `Alt+2` trocam de aba; as teclas antigas continuam (`Espaço` fala, `↑` `↓` intensidade, `F` fade).
  - **ESPELHAR** + código da sala ficam no canto direito da barra de abas.
- **v1 (mais antiga) — `v1/palco.html`**: o palco como era até 25/09, guardado igual (também no branch `v1` do GitHub). Usa as mesmas faixas de `audio/` e o mesmo celular.

O controle do celular (`espelho/PREACH_ESPELHO.html`) funciona com as três versões.

## Site (GitHub Pages)

`https://jholmine50-dotcom.github.io/TheChurchedBeta1/`

- **`palco.html`** — o palco no navegador, com som (baixa as faixas de `audio/`).
- **`espelho/PREACH_ESPELHO.html`** — controle (36 KB), leve, roda em qualquer celular.
- **`index.html`** — porta de entrada: digite o código e vai direto pro controle.
- Ativado em **Settings → Pages → Deploy from a branch → `main` → `/ (root)`** (workflow `.github/workflows/pages.yml`).

## Arquivo grande

O `PREACH_FLOW_V10_ESPELHO.html` tem **227 MB** e **não cabe no GitHub** (limite de 100 MB por arquivo).
Hospede-o separadamente (EdgeOne, servidor próprio ou rode direto no PC com duplo clique).

## Regras do repositório

Só código — com **uma exceção**: `audio/` (as 28 faixas que o `palco.html` toca, 170 MB). Mídia de trabalho (wav, masters), HTMLs gigantes, logs e chaves de API ficam de fora — ver `.gitignore`.
