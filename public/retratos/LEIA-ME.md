# Retratos dos heróis

Jogue aqui um arquivo `.jpg` com o **id do herói** como nome, e ele passa a
aparecer no lugar do brasão gerado por código. Nada mais precisa ser feito: o
CSS carrega o arquivo por cima do brasão, e o brasão só aparece quando o
arquivo não existe.

```
public/retratos/ff7-cloud.jpg
public/retratos/hy-link.jpg
public/retratos/bl-alucard.jpg
```

Os ids estão em `public/data/guildas.json`, no campo `id` de cada herói.

**Formato:** a moldura é 3:2 deitada e o corte é feito a partir do topo (o rosto
costuma ficar na parte de cima). Algo em torno de 600×400 já é mais do que
suficiente — o retrato aparece com cerca de 360px de largura.

As cenas das provas funcionam do mesmo jeito, em `public/cenas/<id do
desafio>.jpg`, com os ids em `public/data/desafios.json`.
