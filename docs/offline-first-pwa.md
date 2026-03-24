# Offline-First Realista para o TaskManager

## Como funciona agora

- O `service worker` em [public/sw.js](/C:/Users/leo_n/OneDrive/Desktop/Pessoal/Projetos/TaskManager/public/sw.js) trata `push` e cache de assets estaticos.
- O scheduler local em [src/components/notifications/occurrence-notification-scheduler.tsx](/C:/Users/leo_n/OneDrive/Desktop/Pessoal/Projetos/TaskManager/src/components/notifications/occurrence-notification-scheduler.tsx) agenda notificacoes com `setTimeout`.
- A criacao e edicao de tarefas passam pela API HTTP e nao eram resilientes offline.

## Limites reais de PWA

- `Push` via backend + service worker pode chegar com o app fechado, desde que o navegador e o dispositivo aceitem Web Push.
- Scheduler local no cliente nao continua rodando com o app fechado. `setTimeout` e polling param quando a pagina some.
- `Background Sync` nao existe ou nao e confiavel em todos os navegadores. Ele foi implementado como tentativa extra, nunca como garantia.
- Em varios ambientes, a sincronizacao real so acontece quando o usuario reabre o app, volta o foco ou o navegador decide entregar o evento.

## O que foi implementado

- IndexedDB para cache local de tarefas, ocorrencias e fila offline.
- Fila offline para `createTask`, `updateTask`, `completeOccurrence` e `ignoreOccurrence`.
- `clientId` persistente no backend para criacao idempotente de tarefa.
- Reconciliacao de ocorrencia por `taskId + scheduledAt` para tratar ocorrencias criadas localmente antes do sync.
- Scheduler local baseado no cache offline enquanto o app esta ativo.
- Tentativa de sync via `Background Sync` + fallback consistente ao abrir/focar/voltar online.

## Comportamento esperado

- Criar tarefa offline salva localmente e persiste apos reload.
- Ocorrencias locais da tarefa sao geradas no cache e podem disparar notificacao local com o app aberto.
- Quando a rede volta, a fila tenta sincronizar sem duplicar tarefa.
- Se o navegador nao rodar `Background Sync`, o fallback acontece ao abrir ou focar o app.
