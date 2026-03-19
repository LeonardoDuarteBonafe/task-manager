# Proposal: MVP1 Task Management

## Context
O objetivo é criar um software pessoal em formato PWA para gerenciamento de tarefas recorrentes do dia a dia, com foco em notificações, controle de tarefas vencidas e simplicidade de uso em desktop e mobile.

## Problem
Tarefas recorrentes como tomar remédio ou colocar o lixo para fora são esquecidas com frequência. Aplicativos genéricos de tarefas não atendem bem o cenário de recorrência com insistência de notificação até tratamento da tarefa.

## Goal
Entregar um MVP1 que permita:
- login com e-mail e senha
- login com Google
- criar e editar tarefas
- recorrência diária e semanal em dias específicos
- listar tarefas vencidas
- listar próximas tarefas
- concluir uma tarefa vencida após o horário
- ignorar uma ocorrência
- encerrar uma tarefa recorrente
- repetir notificações até a ocorrência ser tratada
- uso em formato PWA

## In Scope
- autenticação
- dashboard
- CRUD de tarefas
- recorrência diária
- recorrência semanal
- data final opcional
- notificações repetidas
- concluir ocorrência vencida
- encerrar tarefa
- histórico de status básico

## Out of Scope
- relatórios
- subtarefas
- compartilhamento avançado
- calendário completo
- reagendamento individual
- categorias complexas

## Key Product Rules
- uma ocorrência vencida pode ser concluída depois do horário previsto
- ignorar afeta apenas a ocorrência
- encerrar tarefa impede novas ocorrências e novas notificações futuras
- tarefas vencidas aparecem antes das próximas tarefas