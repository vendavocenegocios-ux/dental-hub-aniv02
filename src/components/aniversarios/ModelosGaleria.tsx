import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ModeloMensagem {
  id: string;
  imagem_url: string;
}

interface Props {
  categoria?: string;
  selectedId: string | null;
  onSelect: (modelo: ModeloMensagem) => void;
}

export function ModelosGaleria({
  categoria = "aniversario",
  selectedId,
  onSelect,
}: Props) {
  const [previewing, setPreviewing] = useState<ModeloMensagem | null>(null);

  const query = useQuery({
    queryKey: ["modelos:galeria", categoria],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos_mensagens")
        .select("id, imagem_url")
        .eq("categoria", categoria)
        .eq("ativo", true)
        .order("ordem")
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ModeloMensagem[];
    },
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        Carregando modelos...
      </div>
    );
  }

  if (query.error || !query.data?.length) {
    return null;
  }

  const handleConfirm = () => {
    if (previewing) {
      onSelect(previewing);
      setPreviewing(null);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Imagens disponíveis</span>
        <span className="text-xs text-muted-foreground">
          (clique para ampliar)
        </span>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {query.data.map((m) => {
          const selected = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setPreviewing(m)}
              className={cn(
                "group relative flex w-24 shrink-0 flex-col overflow-hidden rounded-lg border bg-background transition-all hover:shadow-md",
                selected
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50",
              )}
            >
              <div className="relative aspect-square w-full bg-muted">
                <img
                  src={m.imagem_url}
                  alt="Modelo"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {selected && (
                  <div className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={!!previewing}
        onOpenChange={(o) => !o && setPreviewing(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="overflow-hidden rounded-md border bg-muted/30">
              <img
                src={previewing.imagem_url}
                alt="Pré-visualização do modelo"
                className="max-h-[60vh] w-full object-contain"
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setPreviewing(null)}>
              Voltar
            </Button>
            <Button onClick={handleConfirm}>Usar esta imagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
