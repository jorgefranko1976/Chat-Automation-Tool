import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, AlertTriangle, CheckCircle, Activity, RefreshCw, Search, Send, Clock, Database, TrendingUp, Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardStats {
  queriesToday: number;
  batchesToday: number;
  submissionsToday: number;
  submissionsSuccessToday: number;
  submissionsErrorToday: number;
  totalBatches: number;
  totalSuccessRate: number;
}

interface RndcStatus {
  status: "online" | "offline" | "timeout" | "checking" | "error";
  latency: number;
  lastCheck: Date | null;
}

interface RecentQuery {
  id: string;
  queryType: string;
  queryName: string;
  numIdTercero?: string;
  status: string;
  createdAt: string;
}

interface RecentBatch {
  id: string;
  type: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const { settings, getActiveWsUrl } = useSettings();
  const [rndcStatus, setRndcStatus] = useState<RndcStatus>({
    status: "checking",
    latency: 0,
    lastCheck: null,
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: queriesData } = useQuery({
    queryKey: ["/api/rndc/queries", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/queries?limit=5");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: batchesData } = useQuery({
    queryKey: ["/api/rndc/batches", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/batches?limit=5");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const stats: DashboardStats = statsData?.stats || {
    queriesToday: 0,
    batchesToday: 0,
    submissionsToday: 0,
    submissionsSuccessToday: 0,
    submissionsErrorToday: 0,
    totalBatches: 0,
    totalSuccessRate: 0,
  };

  const recentQueries: RecentQuery[] = queriesData?.queries || [];
  const recentBatches: RecentBatch[] = batchesData?.batches || [];

  const checkRndcStatus = async () => {
    setRndcStatus(prev => ({ ...prev, status: "checking" }));
    try {
      const wsUrl = getActiveWsUrl();
      const res = await fetch("/api/rndc/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wsUrl }),
      });
      const data = await res.json();
      setRndcStatus({
        status: data.status || "error",
        latency: data.latency || 0,
        lastCheck: new Date(),
      });
    } catch {
      setRndcStatus({
        status: "error",
        latency: 0,
        lastCheck: new Date(),
      });
    }
  };

  useEffect(() => {
    checkRndcStatus();
    const interval = setInterval(checkRndcStatus, 60000);
    return () => clearInterval(interval);
  }, [settings.wsEnvironment]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online": return "En Línea";
      case "offline": return "Sin Conexión";
      case "timeout": return "Tiempo Agotado";
      case "checking": return "Verificando...";
      default: return "Error";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-green-600";
      case "offline": return "text-red-600";
      case "timeout": return "text-yellow-600";
      case "checking": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  const getBatchTypeName = (type: string) => {
    switch (type) {
      case "control_points": return "Puntos Control";
      case "cumplido_remesa": return "Cumplido Remesa";
      case "cumplido_manifiesto": return "Cumplido Manifiesto";
      default: return type;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de operaciones y estado de conexión RNDC.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Consultas Hoy"
            value={stats.queriesToday.toString()}
            icon={Search}
            description="Consultas RNDC realizadas"
            data-testid="stats-queries-today"
          />
          <StatsCard
            title="Envíos Hoy"
            value={stats.submissionsToday.toString()}
            icon={Send}
            description={`${stats.submissionsSuccessToday} exitosos, ${stats.submissionsErrorToday} errores`}
            trend={stats.submissionsToday > 0 ? {
              value: Math.round((stats.submissionsSuccessToday / stats.submissionsToday) * 100),
              label: "% éxito",
              positive: stats.submissionsSuccessToday > stats.submissionsErrorToday,
            } : undefined}
            data-testid="stats-submissions-today"
          />
          <StatsCard
            title="Lotes Totales"
            value={stats.totalBatches.toString()}
            icon={Database}
            description={`${stats.batchesToday} hoy`}
            trend={stats.totalSuccessRate > 0 ? {
              value: stats.totalSuccessRate,
              label: "% éxito global",
              positive: stats.totalSuccessRate >= 80,
            } : undefined}
            data-testid="stats-total-batches"
          />
          <Card className="relative overflow-hidden" data-testid="card-rndc-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado RNDC</CardTitle>
              <Activity className={`h-4 w-4 ${getStatusColor(rndcStatus.status)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(rndcStatus.status)}`}>
                {getStatusLabel(rndcStatus.status)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {rndcStatus.status === "checking" ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando conexión...
                  </span>
                ) : (
                  <>
                    Latencia: {rndcStatus.latency}ms
                    {rndcStatus.lastCheck && (
                      <> | Últ. check: {format(rndcStatus.lastCheck, "HH:mm:ss")}</>
                    )}
                  </>
                )}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={checkRndcStatus}
                disabled={rndcStatus.status === "checking"}
                data-testid="button-refresh-rndc"
              >
                <RefreshCw className={`h-3 w-3 ${rndcStatus.status === "checking" ? "animate-spin" : ""}`} />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-recent-queries">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-500" />
                Últimas Consultas
              </CardTitle>
              <CardDescription>Consultas recientes al RNDC</CardDescription>
            </CardHeader>
            <CardContent>
              {recentQueries.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No hay consultas recientes
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {recentQueries.map((query) => (
                      <div 
                        key={query.id} 
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`query-item-${query.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {query.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{query.queryName}</p>
                            <p className="text-xs text-muted-foreground">
                              {query.numIdTercero && `ID: ${query.numIdTercero} | `}
                              {format(new Date(query.createdAt), "dd/MM HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={query.status === "success" ? "default" : "destructive"}>
                          {query.status === "success" ? "OK" : "Error"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-batches">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-purple-500" />
                Últimos Lotes Enviados
              </CardTitle>
              <CardDescription>Lotes de envíos recientes al RNDC</CardDescription>
            </CardHeader>
            <CardContent>
              {recentBatches.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No hay lotes recientes
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {recentBatches.map((batch) => (
                      <div 
                        key={batch.id} 
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`batch-item-${batch.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {batch.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : batch.status === "processing" ? (
                            <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{getBatchTypeName(batch.type)}</p>
                            <p className="text-xs text-muted-foreground">
                              {batch.totalRecords} registros | 
                              <span className="text-green-600"> {batch.successCount} OK</span> | 
                              <span className="text-red-600"> {batch.errorCount} Error</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={batch.status === "completed" ? "default" : "secondary"}>
                            {batch.status === "completed" ? "Completado" : batch.status === "processing" ? "Procesando" : batch.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(batch.createdAt), "dd/MM HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-environment-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Configuración Activa
            </CardTitle>
            <CardDescription>Información del entorno de trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Entorno</p>
                <p className="font-medium">
                  <Badge variant={settings.wsEnvironment === "production" ? "default" : "secondary"}>
                    {settings.wsEnvironment === "production" ? "Producción" : "Pruebas"}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NIT Empresa</p>
                <p className="font-mono font-medium">{settings.companyNit || "No configurado"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuario RNDC</p>
                <p className="font-mono font-medium">{settings.usernameRndc || "No configurado"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuario GPS</p>
                <p className="font-mono font-medium">{settings.usernameGps || "No configurado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
