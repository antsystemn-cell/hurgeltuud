import { useOrders, useDrivers, useSourceSystems, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Reports() {
  const { data: orders } = useOrders();
  const { data: drivers } = useDrivers();
  const { data: sources } = useSourceSystems();

  // By source
  const bySource = sources?.map((s) => ({
    name: s.name,
    count: orders?.filter((o) => o.source_system_id === s.id).length || 0,
  })) || [];

  // Manual orders (no source system)
  const manualCount = orders?.filter((o) => !o.source_system_id).length || 0;

  // By driver
  const byDriver = drivers?.map((d) => ({
    name: (d.profiles as unknown as { full_name: string }).full_name,
    count: orders?.filter((o) => o.assigned_driver_user_id === d.user_id).length || 0,
  })) || [];

  // By status
  const byStatus = Object.entries(FULFILLMENT_LABELS).map(([k, v]) => ({
    label: v,
    count: orders?.filter((o) => o.fulfillment_status === k).length || 0,
  }));

  // By payment
  const byPayment = Object.entries(PAYMENT_LABELS).map(([k, v]) => ({
    label: v,
    count: orders?.filter((o) => o.payment_status === k).length || 0,
  }));

  // Today
  const today = new Date().toISOString().split("T")[0];
  const todayCount = orders?.filter((o) => o.created_at >= today).length || 0;

  // Total revenue
  const totalRevenue = orders?.reduce((s, o) => s + (Number(o.total_amount) || 0), 0) || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Тайлан</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Нийт захиалга</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-semibold">{orders?.length || 0}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Өнөөдөр</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-semibold">{todayCount}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Нийт орлого</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-semibold">₮{totalRevenue.toLocaleString()}</span></CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By source */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Эх сайтаар</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bySource.map((s) => (
              <div key={s.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Гараар</span>
              <span className="font-medium">{manualCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* By driver */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Жолоочоор</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byDriver.map((d) => (
              <div key={d.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-medium">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By fulfillment */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Статусаар</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byStatus.map((s) => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By payment */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Төлбөрөөр</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byPayment.map((p) => (
              <div key={p.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
