import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Upload, Save, ImageIcon } from "lucide-react";

export interface ModeloRow {
  id: string;
  categoria: string;
  imagem_url: string;
  imagem_path: string;
  ativo: boolean;
  ordem: number;
}

const BUCKET = "modelos-mensagens";
const CATEGORIA_FIXA = "aniversario";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: ModeloRow | null;
  onSaved: () => void;
}

export function ModeloDialog({ open, onOpenChange, modelo, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ativo, setAtivo] = useState(true);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [imagemPath, setImagemPath] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (modelo) {
      setAtivo(modelo.ativo);
      setImagemUrl(modelo.imagem_url);
      setImagemPath(modelo.imagem_path);
    } else {
      setAtivo(true);
      setImagemUrl(null);
      setImagemPath(null);
    }
    setPendingFile(null);
    setLocalPreview((c) => {
      if (c?.startsWith("blob:")) URL.revokeObjectURL(c);
      return null;
    });
  }, [open, modelo]);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setLocalPreview((c) => {
      if (c?.startsWith("blob:")) URL.revokeObjectURL(c);
      return URL.createObjectURL(f);
    });
    setPendingFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!modelo && !pendingFile) return toast.error("Selecione uma imagem");

    setSaving(true);
    try {
      let nextUrl = imagemUrl;
      let nextPath = imagemPath;
      let oldPath: string | null = null;

      if (pendingFile) {
        const ext =
          (pendingFile.name.split(".").pop() || "png")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "png";
        const path = `${CATEGORIA_FIXA}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, pendingFile, {
            upsert: false,
            contentType: pendingFile.type || undefined,
            cacheControl: "3600",
          });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        oldPath = imagemPath;
        nextUrl = pub.publicUrl;
        nextPath = path;
      }

      if (modelo) {
        const { error } = await supabase
          .from("modelos_mensagens")
          .update({
            categoria: CATEGORIA_FIXA,
            imagem_url: nextUrl,
            imagem_path: nextPath,
            ativo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", modelo.id);
        if (error) throw error;
        if (oldPath && oldPath !== nextPath) {
          await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      } else {
        const { error } = await supabase.from("modelos_mensagens").insert({
          categoria: CATEGORIA_FIXA,
          imagem_url: nextUrl,
          imagem_path: nextPath,
          ativo,
        });
        if (error) throw error;
      }

      toast.success(modelo ? "Modelo atualizado" : "Modelo enviado");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("[ModeloDialog] save error", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const preview = localPreview ?? imagemUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{modelo ? "Editar imagem" : "Nova imagem"}</DialogTitle>
          <DialogDescription>
            Suba uma imagem que ficará disponível para os clientes escolherem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <div className="overflow-hidden rounded-md border bg-muted/30">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="max-h-80 w-full object-contain"
              />
            ) : (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <ImageIcon className="mr-2 h-5 w-5" />
                Sem imagem
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
          >
            <Upload className="mr-2 h-4 w-4" />
            {preview ? "Trocar imagem" : "Selecionar imagem"}
          </Button>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WEBP. Máx 5MB.
          </p>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Inativos não aparecem para os clientes.
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
