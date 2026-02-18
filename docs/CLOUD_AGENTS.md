# Cloud Agents

Este documento padroniza a execucao de Cloud Agents neste repositorio.

## Como rodar Cloud Agents (Cloud)

Use o ambiente Cloud no Cursor e execute as tarefas no repositorio remoto conectado.
Antes de qualquer alteracao, siga o setup padrao:

```sh
corepack enable && pnpm install --frozen-lockfile
```

## Fluxo obrigatorio de git

Sempre trabalhe em branch dedicada e abra Pull Request.
Nunca faca commit ou push direto na branch `main`.

## Validacao padrao

Antes de abrir PR, execute:

```sh
pnpm lint && pnpm build
```

## Se o PR automatico falhar

Abra manualmente no navegador usando:

`/pull/new/<branch>`

Exemplo completo:
`https://github.com/<owner>/<repo>/pull/new/<branch>`

## Logs e monitoramento

Consulte logs de execucao em:
`https://cursor.com/agents`

## Spend limits

Os limites de gasto (spend limits) devem ser configurados no dashboard do provedor/organizacao antes de execucoes recorrentes.
