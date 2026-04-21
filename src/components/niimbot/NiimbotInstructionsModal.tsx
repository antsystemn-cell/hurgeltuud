import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detectPlatform, type Platform } from "@/lib/niimbot/transfer";
import { FileSpreadsheet, Image as ImageIcon, Smartphone } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "xlsx" | "png";
}

const platformHint: Record<Platform, string> = {
  android:
    "Файл татагдсан бол Niimbot аппаа нээгээд доорх алхмуудыг дагана уу.",
  ios:
    "iPhone дээр Files апп → Downloads хавтаснаас файлаа олоод Share → Niimbot руу илгээнэ үү.",
  desktop:
    "Файл татагдсан. Үүнийг Niimbot апптай утсан руу шилжүүлж эсвэл Niimbot Desktop дээр нээгээд хэвлээрэй.",
};

export function NiimbotInstructionsModal({ open, onOpenChange, mode }: Props) {
  const platform = detectPlatform();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "xlsx" ? (
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            ) : (
              <ImageIcon className="h-5 w-5 text-primary" />
            )}
            Файл татагдлаа
          </DialogTitle>
          <DialogDescription>{platformHint[platform]}</DialogDescription>
        </DialogHeader>

        {mode === "xlsx" ? (
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            <li>
              Niimbot аппаа нээгээд урьдчилан үүсгэсэн{" "}
              <span className="font-medium">шошгоны загвараа</span> сонгоно.
            </li>
            <li>
              Дээд талаас <span className="font-medium">Import Data</span> /{" "}
              <span className="font-medium">Excel импорт</span> товчийг дарна.
            </li>
            <li>Татсан .xlsx файлаа сонгоно.</li>
            <li>
              Текст талбар бүрд тохирох{" "}
              <span className="font-medium">баганы нэрийг</span> (order_no,
              customer_name, address, г.м) холбоно.
            </li>
            <li>
              <span className="font-medium">Print Multiple</span> дарж бүх
              захиалгыг нэг дор хэвлэнэ.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            <li>Niimbot аппаа нээнэ.</li>
            <li>
              <span className="font-medium">Print Image</span> /{" "}
              <span className="font-medium">Зураг хэвлэх</span> сонголтыг сонгоно.
            </li>
            <li>Татсан PNG файлаа сонгоно.</li>
            <li>Хэмжээг 70×80мм болгож баталгаажуулаад хэвлэнэ.</li>
          </ol>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Хэрэв файл автоматаар нээгдэхгүй бол Files / Downloads хэсгээс
            файлаа нээгээд Open with → Niimbot сонгоорой.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
