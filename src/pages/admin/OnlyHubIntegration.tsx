import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const OMH_CODE = "only_merchants_hub";
const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

type SourceSystem = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  api_key: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
};

type WebhookLog = {
  id: string;
  created_at: string;
  event_id: string | null;
  event_type: string;
  success: boolean | null;
  attempt_count: number | null;
  response_status: number | null;
  response_body: string | null;
  payload: unknown;
};

export default function OnlyHubIntegrationPage() {
  const qc = useQueryClient();

  const { data: omh, isLoading } = useQuery({
    queryKey: ["only_hub_source"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_systems")
        .select("id, name, code, active, api_key, webhook_url, webhook_secret")
        .eq("code", OMH_CODE)
        .maybeSingle();
      if (error) throw error;
      return data as SourceSystem | null;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["only_hub_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("id, created_at, event_id, event_type, success, attempt_count, response_status, response_body, payload")
        .eq("event_type", "omh_status_sync")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as WebhookLog[];
    },
  });

  const [form, setForm] = useState({ api_key: "", webhook_url: "", webhook_secret: "" });

  useEffect(() => {
    if (omh) {
      setForm({
        api_key: omh.api_key || "",
        webhook_url: omh.webhook_url || "",
        webhook_secret: omh.webhook_secret || "",
      });
    }
  }, [omh]);

  const save = useMutation({
    mutationFn: async () => {
      if (omh) {
        const { error } = await supabase
          .from("source_systems")
          .update({
            api_key: form.api_key || null,
            webhook_url: form.webhook_url || null,
            webhook_secret: form.webhook_secret || null,
          })
          .eq("id", omh.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("source_systems").insert({
          name: "Only Merchants Hub",
          code: OMH_CODE,
          active: true,
          api_key: form.api_key || null,
          webhook_url: form.webhook_url || null,
          webhook_secret: form.webhook_secret || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Тохиргоо хадгалагдлаа");
      qc.invalidateQueries({ queryKey: ["only_hub_source"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Гадаад мерчант холболт (Only Hub)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Only Hub-аас захиалга хүлээн авах, төлөв буцаах болон хүргэлтийн төлөв өөрчлөгдөх бүрд webhook илгээх тохиргоо.
        </p>
      </div>

      {/* Inbound endpoints reference */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Inbound endpoint-ууд (Only Hub эдгээр рүү илгээнэ)</h3>
        <p className="text-xs text-muted-foreground">Захиалга хүлээн авах (header: <code>x-api-key</code>):</p>
        <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{FUNCTIONS_BASE}/order-intake</p>
        <p className="text-xs text-muted-foreground">Төлөв шинэчлэх (header: <code>x-api-key</code>):</p>
        <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{FUNCTIONS_BASE}/status-update-inbound</p>
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          <p className="text-xs font-medium text-foreground">Дэлгүүрийн ангилал (нэг API-аар олон дэлгүүрийн захиалга)</p>
          <p className="text-[11px] text-muted-foreground">
            Захиалга илгээхдээ <code>order-intake</code> body дотор аль дэлгүүрийнх болохыг доорх талбараар нэмж илгээнэ үү. Ингэснээр Swift Delivery Hub дээр захиалгыг дэлгүүрээр нь ангилж, шүүж харна.
          </p>
          <p className="text-[11px] font-mono bg-muted px-2 py-1 rounded break-all">
            {`{ "merchant_code": "shop_123", "merchant_name": "Дэлгүүрийн нэр", ... }`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <code>shop_code</code>/<code>shop_id</code>, <code>shop_name</code> нэрсийг бас хүлээн авна.
          </p>
        </div>


      {/* Config form */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Холболтын тохиргоо</h3>
        {isLoading ? (
          <p className="text-muted-foreground">Уншиж байна...</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>SWIFT_DELIVERY_API_KEY (inbound түлхүүр)</Label>
              <Input
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="omh_..."
              />
              <p className="text-[11px] text-muted-foreground">
                Only Hub-аас захиалга/төлөв илгээхдээ ашиглах <code>x-api-key</code>. Only Hub-той ижил утгатай байна.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>ONLY_HUB_WEBHOOK_URL (outbound)</Label>
              <Input
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://...lovable.app/api/public/delivery/webhook"
              />
              <p className="text-[11px] text-muted-foreground">
                Хүргэлтийн төлөв өөрчлөгдөх бүрд Swift Delivery Hub энэ хаяг руу webhook илгээнэ.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>ONLY_HUB_WEBHOOK_KEY (outbound түлхүүр)</Label>
              <Input
                value={form.webhook_secret}
                onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                placeholder="Only Hub-аас өгсөн түлхүүр"
              />
              <p className="text-[11px] text-muted-foreground">
                Outbound webhook-ийн <code>x-api-key</code> header-т явуулна.
              </p>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Хадгалж байна..." : "Хадгалах"}
            </Button>
          </>
        )}
      </div>

      {/* Webhook logs */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Webhook лог</h3>
        {!logs?.length ? (
          <p className="text-muted-foreground text-sm">Лог бүртгэл алга байна.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border border-border rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={log.success ? "default" : "destructive"}>
                    {log.success ? "Амжилттай" : "Алдаатай"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("mn-MN")}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  event_id: <span className="font-mono">{log.event_id || "—"}</span>
                </p>
                <p className="text-muted-foreground">
                  Оролдлого: {log.attempt_count ?? 1} · HTTP {log.response_status ?? "—"}
                </p>
                {!log.success && log.response_body && (
                  <p className="text-destructive break-all">last_error: {log.response_body}</p>
                )}
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Payload</summary>
                  <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
