import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, ExternalLink, Github, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/limpar-github")({
  component: LimparGithubPage,
});

type Etapa = {
  nome: string;
  ok: boolean;
  detalhe?: string;
};

function LimparGithubPage() {
  const [executando, setExecutando] = useState(false);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [concluido, setConcluido] = useState(false);

  async function limparTudo() {
    setExecutando(true);
    setEtapas([]);
    setConcluido(false);
    const resultado: Etapa[] = [];

    // 1. localStorage — chaves relacionadas a github
    try {
      let removidos = 0;
      const chaves = Object.keys(localStorage);
      for (const chave of chaves) {
        if (/github|gh[_-]|octokit|oauth/i.test(chave)) {
          localStorage.removeItem(chave);
          removidos++;
        }
      }
      resultado.push({ nome: "localStorage", ok: true, detalhe: `${removidos} chave(s) removida(s)` });
    } catch (e) {
      resultado.push({ nome: "localStorage", ok: false, detalhe: String(e) });
    }

    // 2. sessionStorage — chaves relacionadas a github
    try {
      let removidos = 0;
      const chaves = Object.keys(sessionStorage);
      for (const chave of chaves) {
        if (/github|gh[_-]|octokit|oauth/i.test(chave)) {
          sessionStorage.removeItem(chave);
          removidos++;
        }
      }
      resultado.push({ nome: "sessionStorage", ok: true, detalhe: `${removidos} chave(s) removida(s)` });
    } catch (e) {
      resultado.push({ nome: "sessionStorage", ok: false, detalhe: String(e) });
    }

    // 3. Cookies do domínio atual contendo "github" ou "gh_"
    try {
      let removidos = 0;
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const nome = cookie.split("=")[0]?.trim();
        if (nome && /github|gh[_-]|oauth/i.test(nome)) {
          document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
          removidos++;
        }
      }
      resultado.push({ nome: "Cookies do site", ok: true, detalhe: `${removidos} cookie(s) removido(s)` });
    } catch (e) {
      resultado.push({ nome: "Cookies do site", ok: false, detalhe: String(e) });
    }

    // 4. Cache API
    try {
      if ("caches" in window) {
        const nomes = await caches.keys();
        let removidos = 0;
        for (const nome of nomes) {
          if (/github|gh[_-]|oauth/i.test(nome)) {
            await caches.delete(nome);
            removidos++;
          }
        }
        resultado.push({ nome: "Cache API", ok: true, detalhe: `${removidos} cache(s) removido(s)` });
      } else {
        resultado.push({ nome: "Cache API", ok: true, detalhe: "Não disponível neste navegador" });
      }
    } catch (e) {
      resultado.push({ nome: "Cache API", ok: false, detalhe: String(e) });
    }

    // 5. Service Workers
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        let removidos = 0;
        for (const reg of regs) {
          const scope = reg.scope || "";
          if (/github|gh[_-]|oauth/i.test(scope)) {
            await reg.unregister();
            removidos++;
          }
        }
        resultado.push({ nome: "Service Workers", ok: true, detalhe: `${removidos} worker(s) removido(s)` });
      } else {
        resultado.push({ nome: "Service Workers", ok: true, detalhe: "Não disponível neste navegador" });
      }
    } catch (e) {
      resultado.push({ nome: "Service Workers", ok: false, detalhe: String(e) });
    }

    setEtapas(resultado);
    setConcluido(true);
    setExecutando(false);
    toast.success("Limpeza concluída!");
  }

  function abrirLogoutGithub() {
    window.open("https://github.com/logout", "_blank", "noopener,noreferrer");
  }

  function abrirInstallations() {
    window.open("https://github.com/settings/installations", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao dashboard
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Github className="h-6 w-6" />
          Limpar sessão e cache do GitHub
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use esta ferramenta quando o painel de conexão com GitHub estiver travado em uma conta antiga
          ou apontando para um repositório que não existe mais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que esta ação faz</CardTitle>
          <CardDescription>
            Remove dados locais relacionados ao GitHub neste navegador. Não altera a conexão do
            projeto na plataforma — para isso, é necessário usar os passos manuais abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>Cookies deste site relacionados ao GitHub / OAuth</li>
            <li>Chaves de localStorage e sessionStorage com referências a GitHub</li>
            <li>Caches do navegador (Cache API) ligados ao GitHub</li>
            <li>Service Workers cujo escopo contém GitHub</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passo 1 — Limpar dados locais</CardTitle>
          <CardDescription>
            Execute a limpeza no seu navegador atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={limparTudo} disabled={executando} className="gap-2">
            {executando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Limpar agora
              </>
            )}
          </Button>

          {etapas.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <ul className="space-y-1 text-sm">
                {etapas.map((e) => (
                  <li key={e.nome} className="flex items-start gap-2">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${e.ok ? "text-green-600" : "text-destructive"}`}
                    />
                    <span>
                      <span className="font-medium text-foreground">{e.nome}:</span>{" "}
                      <span className="text-muted-foreground">{e.detalhe}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passo 2 — Deslogar do GitHub</CardTitle>
          <CardDescription>
            Abra o logout do GitHub em nova aba para forçar uma nova autenticação com outra conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={abrirLogoutGithub} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Abrir github.com/logout
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passo 3 — Revogar o app Lovable no GitHub</CardTitle>
          <CardDescription>
            Em <code className="rounded bg-muted px-1 py-0.5 text-xs">github.com/settings/installations</code>,
            encontre o app <strong>Lovable</strong> e remova/desinstale para que a próxima conexão
            peça autorização do zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={abrirInstallations} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Abrir installations do GitHub
          </Button>
        </CardContent>
      </Card>

      {concluido && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Pronto!</CardTitle>
            <CardDescription>
              Após executar os 3 passos, recarregue a página inteira (Ctrl/Cmd+Shift+R) e tente
              reconectar o projeto ao GitHub. Se ainda travar no repositório antigo, abra uma janela
              anônima — ela ignora todo cache anterior.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
