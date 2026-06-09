import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

const PLATE_REGEX = /^\d{4}\s?[A-Za-zА-Яа-яӨөҮү]{3}$/;

export default function DriverRegister() {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePlateChange = (value: string) => {
    // Auto-format: keep digits then letters, insert a space after 4 digits
    const cleaned = value.replace(/[^0-9A-Za-zА-Яа-яӨөҮү]/g, "").toUpperCase();
    const digits = cleaned.replace(/[^0-9]/g, "").slice(0, 4);
    const letters = cleaned.replace(/[0-9]/g, "").slice(0, 3);
    let formatted = digits;
    if (digits.length === 4 && letters.length > 0) formatted = `${digits} ${letters}`;
    else if (letters.length > 0) formatted = `${digits} ${letters}`;
    setPlate(formatted.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!lastName.trim() || !firstName.trim()) {
      setError("Овог болон нэрээ оруулна уу");
      return;
    }
    if (!PLATE_REGEX.test(plate.trim())) {
      setError("Машины улсын дугаарыг 1234 ABC форматаар оруулна уу");
      return;
    }
    if (phone.replace(/[^0-9]/g, "").length < 8) {
      setError("Зөв утасны дугаар оруулна уу");
      return;
    }
    if (password.length < 6) {
      setError("Нууц үг доод тал нь 6 тэмдэгт байна");
      return;
    }

    setLoading(true);
    const { data, error: fnError } = await supabase.functions.invoke("driver-self-register", {
      body: {
        last_name: lastName,
        first_name: firstName,
        vehicle_plate: plate,
        phone,
        password,
      },
    });
    setLoading(false);

    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Бүртгэл амжилтгүй боллоо");
      return;
    }

    if (data?.session) {
      await supabase.auth.setSession(data.session);
      navigate("/");
      return;
    }
    // Fallback: go to login
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center flex flex-col items-center">
          <img src={logo} alt="ON Shop" className="h-16 w-16 mb-3" />
          <h1 className="text-2xl font-semibold text-foreground">Жолоочоор бүртгүүлэх</h1>
          <p className="text-sm text-muted-foreground mt-1">Бүртгүүлээд шууд идэвхждэг</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lastName">Овог</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName">Нэр</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plate">Машины улсын дугаар</Label>
            <Input
              id="plate"
              value={plate}
              onChange={(e) => handlePlateChange(e.target.value)}
              placeholder="1234 ABC"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Утасны дугаар</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="99001122"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Нууц үг</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
          </Button>
        </form>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Нэвтрэх хуудас руу буцах</span>
        </Link>
      </div>
    </div>
  );
}
