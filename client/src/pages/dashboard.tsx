import { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { StatsCard } from "@/components/stats-card";
import { ManifestCard } from "@/components/manifest-card";
import { MOCK_MANIFESTS, Manifest } from "@/lib/mock-data";
import { Truck, AlertTriangle, CheckCircle, Activity } from "lucide-react";

export default function Dashboard() {
  const [manifests] = useState<Manifest[]>(MOCK_MANIFESTS);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de operaciones y estado de conexión RNDC.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Manifiestos Activos"
            value="12"
            icon={Truck}
            trend={{ value: 12, label: "vs ayer", positive: true }}
          />
          <StatsCard
            title="Reportes Pendientes"
            value="5"
            icon={AlertTriangle}
            description="Control points por reportar"
            trend={{ value: 2, label: "críticos", positive: false }}
          />
          <StatsCard
            title="Reportados Hoy"
            value="28"
            icon={CheckCircle}
            trend={{ value: 8, label: "vs promedio", positive: true }}
          />
          <StatsCard
            title="Estado RNDC"
            value="Online"
            icon={Activity}
            description="Latencia: 45ms"
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Manifiestos Recientes</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {manifests.map((manifest) => (
              <ManifestCard key={manifest.id} manifest={manifest} />
            ))}
            {/* Duplicate for visual density in mockup */}
            <ManifestCard manifest={{...manifests[0], id: "mock-dup-1", consecutive: "113", vehiclePlate: "SVE829"}} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
