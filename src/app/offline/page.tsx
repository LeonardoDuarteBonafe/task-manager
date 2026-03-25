export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Sem conexao para esta rota</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Esta tela nao esta disponivel offline. As rotas preparadas para uso offline real neste momento sao `/tasks` e `/recorrencias`, com shell cacheado e dados locais persistidos.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Quando a internet voltar, recarregue a pagina ou abra uma das rotas suportadas para continuar trabalhando e sincronizar alteracoes pendentes.
        </p>
      </div>
    </main>
  );
}
