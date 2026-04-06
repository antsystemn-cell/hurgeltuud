import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function SourceSystemsPage() {
  const qc = useQueryClient();

  const { data: systems, isLoading } = useQuery({
    queryKey: ["source_systems"],
    queryFn: async () => {
      const { data, error } = await supabase.from("source_systems").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ name: "", code: "", webhook_url: "", webhook_secret: "", notes: "" });

  const createSystem = useMutation({
    mutationFn: async () => {
      // Generate API key
      const apiKey = "sk_" + crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.from("source_systems").insert({
        name: form.name,
        code: form.code,
        api_key: apiKey,
        webhook_url: form.webhook_url || null,
        webhook_secret: form.webhook_secret || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Эх сайт нэмлээ");
      setForm({ name: "", code: "", webhook_url: "", webhook_secret: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["source_systems"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("source_systems").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["source_systems"] }),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Эх сайтууд</h2>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Шинэ эх сайт</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Нэр</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Код</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="shop_only_mn" />
          </div>
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Webhook Secret</Label>
            <Input value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Тэмдэглэл</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
        <Button onClick={() => createSystem.mutate()} disabled={!form.name || !form.code}>Нэмэх</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Уншиж байна...</p>
      ) : (
        <div className="space-y-2">
          {systems?.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Код: {s.code}</p>
                </div>
                <Switch
                  checked={s.active}
                  onCheckedChange={(v) => toggleActive.mutate({ id: s.id, active: v })}
                />
              </div>
              {s.api_key && (
                <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded break-all">
                  API Key: {s.api_key}
                </p>
              )}
              {s.webhook_url && <p className="text-xs text-muted-foreground">Webhook: {s.webhook_url}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
