# Media estática

Esta pasta contém os ficheiros de media estáticos da barbearia.
São importados directamente nos componentes React via `import` — o Vite
faz o hash e bundling automático.

## Estrutura

```
src/media/
  images/
    background-email.png   → fundo dos emails transacionais
    cliente-corte.png      
    corte-barba-detalhe.jpg
    corte-cabelo-detalhe.png
    Resultado.jpg          → foto da secção About na homepage
    brooklyn/
      Cadeiras.jpg         → galeria
      Entrada.jpg          → galeria (destaque)
      Sinuca.jpg           → galeria
    logos/
      logo-*.png / logo-*.svg
  video/
    presentation.mp4       → vídeo de fundo do Hero
```

## Como trocar ficheiros

1. Substitui o ficheiro na pasta correspondente **mantendo o mesmo nome**.
2. Faz commit e push — o Cloudflare Pages faz deploy automático.
3. Se precisares de um nome diferente, actualiza também o `import` em
   `src/pages/public/HomePage.tsx`.

## Vídeo Hero em desktop

O vídeo `presentation.mp4` é vertical (portrait). Em desktop é exibido
centrado com a sua proporção natural. Nas laterais são renderizadas duas
cópias desfocadas e espelhadas para preencher o espaço horizontalmente
sem cortar o conteúdo principal.
