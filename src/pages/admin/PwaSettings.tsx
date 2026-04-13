import { useState, useEffect } from "react";
import { usePwaSettings, useUpdatePwaSettings } from "@/hooks/usePwaSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Smartphone, Save } from "lucide-react";

export default function PwaSettingsPage() {
  const { data: settings, isLoading } = usePwaSettings();
  const updateSettings = useUpdatePwaSettings();

  const [enabled, setEnabled] = useState(true);
  const [frequencyHours, setFrequencyHours] = useState(24);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setFrequencyHours(settings.prompt_frequency_hours);
      setTitle(settings.prompt_title);
      setMessage(settings.prompt_message);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        enabled,
        prompt_frequency_hours: frequencyHours,
        prompt_title: title,
        prompt_message: message,
      },
      {
        onSuccess: () => toast.success("PWA тохиргоо хадгалагдлаа"),
        onError: () => toast.error("Алдаа гарлаа"),
      }
    );
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Уншиж байна...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <Smartphone className="h-5 w-5" />
        Апп суулгах тохиргоо (PWA)
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Суулгах prompt удирдлага</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Суулгах товч идэвхтэй</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Идэвхтэй бол хэрэглэгчдэд апп суулгах prompt харагдана
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Давтамж (цагаар)</Label>
            <Input
              type="number"
              min={1}
              max={720}
              value={frequencyHours}
              onChange={(e) => setFrequencyHours(parseInt(e.target.value) || 24)}
            />
            <p className="text-xs text-muted-foreground">
              Хэрэглэгч "Дараа" дарсны дараа хэдэн цагийн дараа дахин харуулах
            </p>
          </div>

          <div className="space-y-2">
            <Label>Гарчиг</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Апп суулгах"
            />
          </div>

          <div className="space-y-2">
            <Label>Мессеж</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Энэ аппыг утсандаа суулгаснаар..."
              className="min-h-[80px]"
            />
          </div>

          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Хадгалах
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Тайлбар</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• PWA (Progressive Web App) нь вэб аппыг утсанд суулгаж, native апп шиг ашиглах боломж олгоно.</p>
          <p>• Хэрэглэгч Chrome эсвэл Safari хөтчөөр нэвтэрч, "Суулгах" товч дарснаар апп нь утасны нүүр дэлгэц дээр нэмэгдэнэ.</p>
          <p>• "Давтамж" тохиргоо нь хэрэглэгч "Дараа" товч дарсны дараа хэдэн цагийн дараа дахин prompt харуулахыг тодорхойлно.</p>
          <p>• Энэ функц зөвхөн publish хийсний дараа ажиллана, editor preview дотор ажиллахгүй.</p>
        </CardContent>
      </Card>
    </div>
  );
}
