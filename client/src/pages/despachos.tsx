import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, Database, Car, User } from "lucide-react";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";

interface DespachoRow {
  granja: string;
  planta: string;
  placa: string;
  cedula: string;
  toneladas: string;
  fecha: string;
  granjaValid: boolean | null;
  granjaData: { sede: string; coordenadas: string } | null;
  plantaValid: boolean | null;
  plantaData: { sede: string; coordenadas: string } | null;
  placaValid: boolean | null;
  placaData: { propietarioId: string; venceSoat: string; pesoVacio: string } | null;
  cedulaValid: boolean | null;
  cedulaData: { venceLicencia: string } | null;
  errors: string[];
}

export default function Despachos() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DespachoRow[]>([]);
  const [stepAComplete, setStepAComplete] = useState(false);
  const [stepBComplete, setStepBComplete] = useState(false);
  const [stepCComplete, setStepCComplete] = useState(false);
  const [placasProgress, setPlacasProgress] = useState({ current: 0, total: 0, processing: false, currentItem: "" });
  const [cedulasProgress, setCedulasProgress] = useState({ current: 0, total: 0, processing: false, currentItem: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRows([]);
      setStepAComplete(false);
      setStepBComplete(false);
      setStepCComplete(false);
      parseExcel(selectedFile);
    }
  };

  const parseExcel = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    const parsed: DespachoRow[] = jsonData.map((row) => {
      let fechaVal = row["FECHA"] || "";
      if (typeof fechaVal === "number") {
        const date = XLSX.SSF.parse_date_code(fechaVal);
        if (date) {
          fechaVal = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }
      }

      return {
        granja: String(row["GRANJA"] || "").trim(),
        planta: String(row["PLANTA"] || "").trim(),
        placa: String(row["PLACA"] || "").trim().replace(/\s+/g, "").toUpperCase(),
        cedula: String(row["CEDULA"] || "").trim(),
        toneladas: String(row["TONELADAS"] || "").trim(),
        fecha: fechaVal,
        granjaValid: null,
        granjaData: null,
        plantaValid: null,
        plantaData: null,
        placaValid: null,
        placaData: null,
        cedulaValid: null,
        cedulaData: null,
        errors: [],
      };
    });

    setRows(parsed);
  };

  const validateInternalMutation = useMutation({
    mutationFn: async (data: DespachoRow[]) => {
      const response = await apiRequest("POST", "/api/despachos/validate-internal", { rows: data });
      return response.json();
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStepAComplete(true);
      const errorCount = data.rows.filter((r: DespachoRow) => r.errors.length > 0).length;
      toast({
        title: "Paso A completado",
        description: `Datos internos validados. ${errorCount} errores encontrados.`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const validatePlacasMutation = useMutation({
    mutationFn: async ({ data, onlyMissing }: { data: DespachoRow[], onlyMissing: boolean }) => {
      const credentials = settings.usernameRndc && settings.passwordRndc && settings.companyNit ? {
        username: settings.usernameRndc,
        password: settings.passwordRndc,
        nitEmpresa: settings.companyNit,
      } : undefined;
      const response = await apiRequest("POST", "/api/despachos/validate-placas", { rows: data, credentials, onlyMissing });
      const result = await response.json();
      
      if (result.jobId) {
        setPlacasProgress({ current: 0, total: result.total, processing: true, currentItem: "" });
        
        return new Promise<{ rows: DespachoRow[] }>((resolve, reject) => {
          const eventSource = new EventSource(`/api/despachos/progress/${result.jobId}`);
          
          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.done) {
              eventSource.close();
              setPlacasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
              resolve({ rows: data.rows });
            } else {
              setPlacasProgress({ current: data.progress, total: data.total, processing: true, currentItem: data.current });
            }
          };
          
          eventSource.onerror = () => {
            eventSource.close();
            setPlacasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
            reject(new Error("Error en conexión SSE"));
          };
        });
      }
      return result;
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStepBComplete(true);
      const pendingCount = data.rows.filter((r: DespachoRow) => r.placaValid === null && r.placa).length;
      toast({
        title: "Paso B completado",
        description: `Placas consultadas. ${pendingCount > 0 ? `${pendingCount} pendientes.` : ''}`,
        variant: pendingCount > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      setPlacasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const validateCedulasMutation = useMutation({
    mutationFn: async ({ data, onlyMissing }: { data: DespachoRow[], onlyMissing: boolean }) => {
      const credentials = settings.usernameRndc && settings.passwordRndc && settings.companyNit ? {
        username: settings.usernameRndc,
        password: settings.passwordRndc,
        nitEmpresa: settings.companyNit,
      } : undefined;
      const response = await apiRequest("POST", "/api/despachos/validate-cedulas", { rows: data, credentials, onlyMissing });
      const result = await response.json();
      
      if (result.jobId) {
        setCedulasProgress({ current: 0, total: result.total, processing: true, currentItem: "" });
        
        return new Promise<{ rows: DespachoRow[] }>((resolve, reject) => {
          const eventSource = new EventSource(`/api/despachos/progress/${result.jobId}`);
          
          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.done) {
              eventSource.close();
              setCedulasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
              resolve({ rows: data.rows });
            } else {
              setCedulasProgress({ current: data.progress, total: data.total, processing: true, currentItem: data.current });
            }
          };
          
          eventSource.onerror = () => {
            eventSource.close();
            setCedulasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
            reject(new Error("Error en conexión SSE"));
          };
        });
      }
      return result;
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStepCComplete(true);
      const pendingCount = data.rows.filter((r: DespachoRow) => r.cedulaValid === null && r.cedula).length;
      toast({
        title: "Paso C completado",
        description: `Cédulas consultadas. ${pendingCount > 0 ? `${pendingCount} pendientes.` : ''}`,
        variant: pendingCount > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      setCedulasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleExportExcel = () => {
    const exportData = rows.map((row) => ({
      GRANJA: row.granja,
      GRANJA_SEDE: row.granjaData?.sede || "",
      GRANJA_COORDENADAS: row.granjaData?.coordenadas || "",
      PLANTA: row.planta,
      PLANTA_SEDE: row.plantaData?.sede || "",
      PLANTA_COORDENADAS: row.plantaData?.coordenadas || "",
      PLACA: row.placa,
      NUMIDPROPIETARIO: row.placaData?.propietarioId || "",
      FECHAVENCIMIENTOSOAT: row.placaData?.venceSoat || "",
      PESOVEHICULOVACIO: row.placaData?.pesoVacio || "",
      CEDULA: row.cedula,
      FECHAVENCIMIENTOLICENCIA: row.cedulaData?.venceLicencia || "",
      TONELADAS: row.toneladas,
      FECHA: row.fecha,
      ERRORES: row.errors.join("; "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despachos");
    XLSX.writeFile(wb, `despachos_validados_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setStepAComplete(false);
    setStepBComplete(false);
    setStepCComplete(false);
  };

  const getStatusIcon = (valid: boolean | null) => {
    if (valid === null) return <span className="text-muted-foreground">-</span>;
    if (valid) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const hasCredentials = settings.usernameRndc && settings.passwordRndc && settings.companyNit;

  const getProgressA = () => {
    if (rows.length === 0) return 0;
    const granjasDone = rows.filter(r => r.granjaValid !== null).length;
    const plantasDone = rows.filter(r => r.plantaValid !== null).length;
    const total = rows.filter(r => r.granja).length + rows.filter(r => r.planta).length;
    if (total === 0) return 100;
    return Math.round(((granjasDone + plantasDone) / total) * 100);
  };

  const getProgressB = () => {
    const withPlaca = rows.filter(r => r.placa);
    if (withPlaca.length === 0) return 100;
    const done = withPlaca.filter(r => r.placaValid !== null).length;
    return Math.round((done / withPlaca.length) * 100);
  };

  const getProgressC = () => {
    const withCedula = rows.filter(r => r.cedula);
    if (withCedula.length === 0) return 100;
    const done = withCedula.filter(r => r.cedulaValid !== null).length;
    return Math.round((done / withCedula.length) * 100);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Módulo Despachos</h1>
          <p className="text-sm text-muted-foreground">
            Validación de despachos en 3 pasos: A) Datos internos, B) Placas RNDC, C) Cédulas RNDC
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Cargar Excel de Despachos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="file-upload" className="sr-only">Archivo Excel</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                    data-testid="input-file-upload"
                  />
                </div>
                {file && (
                  <Button variant="ghost" size="icon" onClick={clearFile} data-testid="button-clear-file">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs">({rows.length} filas)</span>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                <strong>Columnas esperadas:</strong> GRANJA, PLANTA, PLACA, CEDULA, TONELADAS, FECHA
              </div>

              {!hasCredentials && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span>Configure las credenciales RNDC en Configuración para los pasos B y C.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`border-2 ${stepAComplete ? 'border-green-500 bg-green-50' : 'border-blue-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">A) Datos Internos</span>
                      <span className={`ml-auto text-xs font-bold ${getProgressA() === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                        {getProgressA()}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Valida Granjas y Plantas contra la base de datos local</p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${getProgressA()}%` }}></div>
                    </div>
                    <Button
                      onClick={() => validateInternalMutation.mutate(rows)}
                      disabled={rows.length === 0 || validateInternalMutation.isPending}
                      className="w-full"
                      data-testid="button-validate-internal"
                    >
                      {validateInternalMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</>
                      ) : stepAComplete ? "Revalidar" : "Validar"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${stepBComplete ? 'border-green-500 bg-green-50' : stepAComplete ? 'border-orange-200' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold">B) Placas RNDC</span>
                      <span className={`ml-auto text-xs font-bold ${getProgressB() === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                        {placasProgress.processing 
                          ? `${placasProgress.current}/${placasProgress.total}` 
                          : `${getProgressB()}%`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {placasProgress.processing && placasProgress.currentItem 
                        ? `Consultando: ${placasProgress.currentItem}` 
                        : "Consulta NUMIDPROPIETARIO, SOAT, Peso Vacío"}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div 
                        className="bg-orange-500 h-1.5 rounded-full transition-all" 
                        style={{ width: placasProgress.processing 
                          ? `${placasProgress.total > 0 ? (placasProgress.current / placasProgress.total) * 100 : 0}%` 
                          : `${getProgressB()}%` }}
                      ></div>
                    </div>
                    {stepBComplete && rows.filter(r => r.placaValid === null && r.placa).length > 0 && (
                      <p className="text-xs text-amber-600 mb-2">
                        {rows.filter(r => r.placaValid === null && r.placa).length} placas pendientes
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => validatePlacasMutation.mutate({ data: rows, onlyMissing: false })}
                        disabled={rows.length === 0 || !hasCredentials || validatePlacasMutation.isPending}
                        className="flex-1"
                        variant={stepAComplete ? "default" : "outline"}
                        size="sm"
                        data-testid="button-validate-placas"
                      >
                        {validatePlacasMutation.isPending ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                        ) : stepBComplete ? "Todo" : "Consultar"}
                      </Button>
                      {stepBComplete && rows.filter(r => r.placaValid === null && r.placa).length > 0 && (
                        <Button
                          onClick={() => validatePlacasMutation.mutate({ data: rows, onlyMissing: true })}
                          disabled={!hasCredentials || validatePlacasMutation.isPending}
                          variant="outline"
                          size="sm"
                          data-testid="button-validate-placas-missing"
                        >
                          Faltantes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${stepCComplete ? 'border-green-500 bg-green-50' : stepBComplete ? 'border-purple-200' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold">C) Cédulas RNDC</span>
                      <span className={`ml-auto text-xs font-bold ${getProgressC() === 100 ? 'text-green-600' : 'text-purple-600'}`}>
                        {cedulasProgress.processing 
                          ? `${cedulasProgress.current}/${cedulasProgress.total}` 
                          : `${getProgressC()}%`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {cedulasProgress.processing && cedulasProgress.currentItem 
                        ? `Consultando: ${cedulasProgress.currentItem}` 
                        : "Consulta FECHAVENCIMIENTOLICENCIA"}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div 
                        className="bg-purple-500 h-1.5 rounded-full transition-all" 
                        style={{ width: cedulasProgress.processing 
                          ? `${cedulasProgress.total > 0 ? (cedulasProgress.current / cedulasProgress.total) * 100 : 0}%` 
                          : `${getProgressC()}%` }}
                      ></div>
                    </div>
                    {stepCComplete && rows.filter(r => r.cedulaValid === null && r.cedula).length > 0 && (
                      <p className="text-xs text-amber-600 mb-2">
                        {rows.filter(r => r.cedulaValid === null && r.cedula).length} cédulas pendientes
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => validateCedulasMutation.mutate({ data: rows, onlyMissing: false })}
                        disabled={rows.length === 0 || !hasCredentials || validateCedulasMutation.isPending}
                        className="flex-1"
                        variant={stepBComplete ? "default" : "outline"}
                        size="sm"
                        data-testid="button-validate-cedulas"
                      >
                        {validateCedulasMutation.isPending ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                        ) : stepCComplete ? "Todo" : "Consultar"}
                      </Button>
                      {stepCComplete && rows.filter(r => r.cedulaValid === null && r.cedula).length > 0 && (
                        <Button
                          onClick={() => validateCedulasMutation.mutate({ data: rows, onlyMissing: true })}
                          disabled={!hasCredentials || validateCedulasMutation.isPending}
                          variant="outline"
                          size="sm"
                          data-testid="button-validate-cedulas-missing"
                        >
                          Faltantes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(stepAComplete || stepBComplete || stepCComplete) && (
                <Button variant="outline" onClick={handleExportExcel} data-testid="button-export">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel Enriquecido
                </Button>
              )}
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resultados de Validación</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Granja</th>
                        <th className="text-left p-3 font-medium">Sede</th>
                        <th className="text-left p-3 font-medium">Coord.</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Planta</th>
                        <th className="text-left p-3 font-medium">Sede</th>
                        <th className="text-left p-3 font-medium">Coord.</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Placa</th>
                        <th className="text-left p-3 font-medium">ID Prop.</th>
                        <th className="text-left p-3 font-medium">SOAT</th>
                        <th className="text-left p-3 font-medium">Peso</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Cédula</th>
                        <th className="text-left p-3 font-medium">Lic.</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Ton</th>
                        <th className="text-left p-3 font-medium">Fecha</th>
                        <th className="text-left p-3 font-medium">Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx} className={`border-t ${row.errors.length > 0 ? "bg-red-50" : ""}`}>
                          <td className="p-3 text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">{row.granja}</td>
                          <td className="p-3 text-xs">{row.granjaData?.sede || "-"}</td>
                          <td className="p-3 text-xs font-mono">
                            {row.granjaData?.coordenadas ? (
                              <a 
                                href={`https://www.google.com/maps?q=${row.granjaData.coordenadas}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Ver
                              </a>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-center">{getStatusIcon(row.granjaValid)}</td>
                          <td className="p-3">{row.planta}</td>
                          <td className="p-3 text-xs">{row.plantaData?.sede || "-"}</td>
                          <td className="p-3 text-xs font-mono">
                            {row.plantaData?.coordenadas ? (
                              <a 
                                href={`https://www.google.com/maps?q=${row.plantaData.coordenadas}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Ver
                              </a>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-center">{getStatusIcon(row.plantaValid)}</td>
                          <td className="p-3 font-mono">{row.placa}</td>
                          <td className="p-3 text-xs">{row.placaData?.propietarioId || "-"}</td>
                          <td className="p-3 text-xs">{row.placaData?.venceSoat || "-"}</td>
                          <td className="p-3 text-xs">{row.placaData?.pesoVacio || "-"}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.placaValid)}</td>
                          <td className="p-3">{row.cedula}</td>
                          <td className="p-3 text-xs">{row.cedulaData?.venceLicencia || "-"}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.cedulaValid)}</td>
                          <td className="p-3">{row.toneladas}</td>
                          <td className="p-3">{row.fecha}</td>
                          <td className="p-3 text-red-600 text-xs max-w-xs truncate" title={row.errors.join("; ")}>
                            {row.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
