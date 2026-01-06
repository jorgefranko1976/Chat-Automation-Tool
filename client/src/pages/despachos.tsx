import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, Database, Car, User, RefreshCw, Save, FolderOpen, Trash2, ArrowUpDown, CheckSquare, Square } from "lucide-react";
import * as XLSX from "xlsx";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DespachoRow {
  granja: string;
  planta: string;
  placa: string;
  cedula: string;
  toneladas: string;
  fecha: string;
  granjaValid: boolean | null;
  granjaData: { sede: string; coordenadas: string; flete: string } | null;
  plantaValid: boolean | null;
  plantaData: { sede: string; coordenadas: string } | null;
  placaValid: boolean | null;
  placaData: { propietarioId: string; venceSoat: string; pesoVacio: string; capacidad?: string } | null;
  cedulaValid: boolean | null;
  cedulaData: { venceLicencia: string; nombre?: string } | null;
  horaCargue?: string;
  horaDescargue?: string;
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
  const [currentDespachoId, setCurrentDespachoId] = useState<string | null>(null);
  const [showSavedDespachos, setShowSavedDespachos] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortOrder, setSortOrder] = useState<"default" | "success_first" | "errors_first">("default");

  const { data: savedDespachosData, refetch: refetchDespachos } = useQuery({
    queryKey: ["/api/despachos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/despachos");
      return res.json();
    },
  });

  const savedDespachos = savedDespachosData?.despachos || [];

  const saveDespachoMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const nombre = `Despacho ${today}`;
      const response = await apiRequest("POST", "/api/despachos", {
        nombre,
        fecha: today,
        rows,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentDespachoId(data.despacho.id);
      refetchDespachos();
      toast({ title: "Guardado", description: "Despacho guardado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el despacho", variant: "destructive" });
    },
  });

  const updateDespachoMutation = useMutation({
    mutationFn: async () => {
      if (!currentDespachoId) throw new Error("No hay despacho seleccionado");
      const response = await apiRequest("PUT", `/api/despachos/${currentDespachoId}`, { rows });
      return response.json();
    },
    onSuccess: () => {
      refetchDespachos();
      toast({ title: "Actualizado", description: "Despacho actualizado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el despacho", variant: "destructive" });
    },
  });

  const deleteDespachoMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/despachos/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetchDespachos();
      toast({ title: "Eliminado", description: "Despacho eliminado correctamente" });
    },
  });

  const loadDespacho = async (id: string) => {
    try {
      const res = await apiRequest("GET", `/api/despachos/${id}`);
      const data = await res.json();
      if (data.success && data.despacho) {
        setRows(data.despacho.rows as DespachoRow[]);
        setCurrentDespachoId(data.despacho.id);
        setStepAComplete(true);
        setStepBComplete(true);
        setStepCComplete(true);
        setShowSavedDespachos(false);
        toast({ title: "Cargado", description: `Despacho "${data.despacho.nombre}" cargado` });
      }
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el despacho", variant: "destructive" });
    }
  };

  const updateRow = (idx: number, field: keyof DespachoRow, value: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      if (field === "granja") {
        updated.granjaValid = null;
        updated.granjaData = null;
      }
      if (field === "planta") {
        updated.plantaValid = null;
        updated.plantaData = null;
      }
      if (field === "placa") {
        updated.placaValid = null;
        updated.placaData = null;
      }
      if (field === "cedula") {
        updated.cedulaValid = null;
        updated.cedulaData = null;
      }
      return updated;
    }));
  };

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
          fechaVal = `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
        }
      } else if (typeof fechaVal === "string" && fechaVal.includes("-")) {
        const parts = fechaVal.split("-");
        if (parts.length === 3 && parts[0].length === 4) {
          fechaVal = `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
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

  const validatePlacasInternalMutation = useMutation({
    mutationFn: async ({ data, onlyMissing }: { data: DespachoRow[], onlyMissing: boolean }) => {
      const response = await apiRequest("POST", "/api/despachos/validate-placas-internal", { rows: data, onlyMissing });
      return response.json();
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStepBComplete(true);
      const failedCount = data.rows.filter((r: DespachoRow) => r.placaValid === false && r.placa).length;
      toast({
        title: "Consulta interna completada",
        description: failedCount > 0 ? `${failedCount} placas no encontradas en BD local` : "Todas las placas validadas",
        variant: failedCount > 0 ? "destructive" : "default",
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
        title: "Consulta RNDC completada",
        description: `Placas consultadas y guardadas en caché. ${pendingCount > 0 ? `${pendingCount} pendientes.` : ''}`,
        variant: pendingCount > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      setPlacasProgress({ current: 0, total: 0, processing: false, currentItem: "" });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const validateCedulasInternalMutation = useMutation({
    mutationFn: async ({ data, onlyMissing }: { data: DespachoRow[], onlyMissing: boolean }) => {
      const response = await apiRequest("POST", "/api/despachos/validate-cedulas-internal", { rows: data, onlyMissing });
      return response.json();
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStepCComplete(true);
      const errorCount = data.rows.filter((r: DespachoRow) => r.cedulaValid === false).length;
      toast({
        title: "Validación interna completada",
        description: errorCount > 0 ? `${errorCount} cédulas no encontradas en caché` : "Todas las cédulas validadas",
        variant: errorCount > 0 ? "default" : "default",
      });
    },
    onError: (error: Error) => {
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
    const exportData = rows.map((row) => {
      const ton = parseFloat(row.toneladas.replace(",", ".")) || 0;
      const flete = parseFloat((row.granjaData?.flete || "").replace(/[^\d.-]/g, "")) || 0;
      const valorFlete = ton * flete;
      return {
        GRANJA: row.granja,
        GRANJA_SEDE: row.granjaData?.sede || "",
        GRANJA_COORDENADAS: row.granjaData?.coordenadas || "",
        PLANTA: row.planta,
        PLANTA_SEDE: row.plantaData?.sede || "",
        PLANTA_COORDENADAS: row.plantaData?.coordenadas || "",
        PLACA: row.placa,
        NUMIDPROPIETARIO: row.placaData?.propietarioId || "",
        FECHAVENCIMIENTOSOAT: row.placaData?.venceSoat || "",
        CEDULA: row.cedula,
        FECHAVENCIMIENTOLICENCIA: row.cedulaData?.venceLicencia || "",
        TONELADAS: row.toneladas,
        FLETE: row.granjaData?.flete || "",
        VALOR_FLETE: valorFlete > 0 ? valorFlete : "",
        HORACITAPACTADACARGUE: row.horaCargue || "",
        HORACITAPACTADADESCARGUEREMESA: row.horaDescargue || "",
        CAPACIDAD: row.placaData?.capacidad || "",
        FECHA: row.fecha,
        ERRORES: row.errors.join("; "),
      };
    });

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

  const isRowSuccess = (row: DespachoRow) => {
    return row.errors.length === 0 && 
           row.granjaValid === true && 
           row.plantaValid === true && 
           row.placaValid === true && 
           row.cedulaValid === true;
  };

  const sortedRows = [...rows].map((row, idx) => ({ row, originalIndex: idx })).sort((a, b) => {
    if (sortOrder === "default") return 0;
    const aSuccess = isRowSuccess(a.row);
    const bSuccess = isRowSuccess(b.row);
    if (sortOrder === "success_first") {
      if (aSuccess && !bSuccess) return -1;
      if (!aSuccess && bSuccess) return 1;
    } else if (sortOrder === "errors_first") {
      if (aSuccess && !bSuccess) return 1;
      if (!aSuccess && bSuccess) return -1;
    }
    return 0;
  });

  const successfulRowsCount = rows.filter(isRowSuccess).length;

  const toggleRowSelection = (originalIndex: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(originalIndex)) {
      newSelected.delete(originalIndex);
    } else {
      newSelected.add(originalIndex);
    }
    setSelectedRows(newSelected);
  };

  const selectAllSuccessful = () => {
    const successIndices = rows.map((row, idx) => ({ row, idx }))
      .filter(({ row }) => isRowSuccess(row))
      .map(({ idx }) => idx);
    setSelectedRows(new Set(successIndices));
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
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
                      <span className="font-semibold">B) Placas</span>
                      <span className={`ml-auto text-xs font-bold ${getProgressB() === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                        {placasProgress.processing 
                          ? `${placasProgress.current}/${placasProgress.total}` 
                          : `${getProgressB()}%`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {placasProgress.processing && placasProgress.currentItem 
                        ? `Consultando: ${placasProgress.currentItem}` 
                        : "Valida propietario, SOAT, peso vacío"}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div 
                        className="bg-orange-500 h-1.5 rounded-full transition-all" 
                        style={{ width: placasProgress.processing 
                          ? `${placasProgress.total > 0 ? (placasProgress.current / placasProgress.total) * 100 : 0}%` 
                          : `${getProgressB()}%` }}
                      ></div>
                    </div>
                    {stepBComplete && rows.filter(r => (r.placaValid === null || r.placaValid === false) && r.placa).length > 0 && (
                      <p className="text-xs text-amber-600 mb-2">
                        {rows.filter(r => r.placaValid === false && r.placa).length} fallidas, {rows.filter(r => r.placaValid === null && r.placa).length} pendientes
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          onClick={() => validatePlacasInternalMutation.mutate({ data: rows, onlyMissing: false })}
                          disabled={rows.length === 0 || validatePlacasInternalMutation.isPending || validatePlacasMutation.isPending}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                          data-testid="button-validate-placas-internal"
                        >
                          {validatePlacasInternalMutation.isPending ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                          ) : (
                            <><Database className="mr-1 h-3 w-3" />Interna</>
                          )}
                        </Button>
                        <Button
                          onClick={() => validatePlacasMutation.mutate({ data: rows, onlyMissing: false })}
                          disabled={rows.length === 0 || !hasCredentials || validatePlacasMutation.isPending || validatePlacasInternalMutation.isPending}
                          className="flex-1"
                          variant={stepAComplete ? "default" : "outline"}
                          size="sm"
                          data-testid="button-validate-placas"
                        >
                          {validatePlacasMutation.isPending ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                          ) : (
                            <><RefreshCw className="mr-1 h-3 w-3" />RNDC</>
                          )}
                        </Button>
                      </div>
                      {stepBComplete && rows.filter(r => (r.placaValid === null || r.placaValid === false) && r.placa).length > 0 && (
                        <Button
                          onClick={() => validatePlacasMutation.mutate({ data: rows, onlyMissing: true })}
                          disabled={!hasCredentials || validatePlacasMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="w-full"
                          data-testid="button-validate-placas-missing"
                        >
                          Reintentar fallidas/pendientes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${stepCComplete ? 'border-green-500 bg-green-50' : stepBComplete ? 'border-purple-200' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold">C) Cédulas</span>
                      <span className={`ml-auto text-xs font-bold ${getProgressC() === 100 ? 'text-green-600' : 'text-purple-600'}`}>
                        {cedulasProgress.processing 
                          ? `${cedulasProgress.current}/${cedulasProgress.total}` 
                          : `${getProgressC()}%`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {cedulasProgress.processing && cedulasProgress.currentItem 
                        ? `Consultando: ${cedulasProgress.currentItem}` 
                        : "Valida licencia de conducción"}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div 
                        className="bg-purple-500 h-1.5 rounded-full transition-all" 
                        style={{ width: cedulasProgress.processing 
                          ? `${cedulasProgress.total > 0 ? (cedulasProgress.current / cedulasProgress.total) * 100 : 0}%` 
                          : `${getProgressC()}%` }}
                      ></div>
                    </div>
                    {stepCComplete && rows.filter(r => (r.cedulaValid === null || r.cedulaValid === false) && r.cedula).length > 0 && (
                      <p className="text-xs text-amber-600 mb-2">
                        {rows.filter(r => r.cedulaValid === false && r.cedula).length} fallidas, {rows.filter(r => r.cedulaValid === null && r.cedula).length} pendientes
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          onClick={() => validateCedulasInternalMutation.mutate({ data: rows, onlyMissing: false })}
                          disabled={rows.length === 0 || validateCedulasInternalMutation.isPending || validateCedulasMutation.isPending}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                          data-testid="button-validate-cedulas-internal"
                        >
                          {validateCedulasInternalMutation.isPending ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                          ) : (
                            <><Database className="mr-1 h-3 w-3" />Interna</>
                          )}
                        </Button>
                        <Button
                          onClick={() => validateCedulasMutation.mutate({ data: rows, onlyMissing: false })}
                          disabled={rows.length === 0 || !hasCredentials || validateCedulasMutation.isPending || validateCedulasInternalMutation.isPending}
                          className="flex-1"
                          variant={stepBComplete ? "default" : "outline"}
                          size="sm"
                          data-testid="button-validate-cedulas"
                        >
                          {validateCedulasMutation.isPending ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />...</>
                          ) : (
                            <><RefreshCw className="mr-1 h-3 w-3" />RNDC</>
                          )}
                        </Button>
                      </div>
                      {stepCComplete && rows.filter(r => (r.cedulaValid === null || r.cedulaValid === false) && r.cedula).length > 0 && (
                        <Button
                          onClick={() => validateCedulasMutation.mutate({ data: rows, onlyMissing: true })}
                          disabled={!hasCredentials || validateCedulasMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="w-full"
                          data-testid="button-validate-cedulas-missing"
                        >
                          Reintentar fallidas/pendientes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(stepAComplete || stepBComplete || stepCComplete) && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleExportExcel} data-testid="button-export">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </Button>
                  {currentDespachoId ? (
                    <Button 
                      variant="outline" 
                      onClick={() => updateDespachoMutation.mutate()}
                      disabled={updateDespachoMutation.isPending}
                      data-testid="button-update-despacho"
                    >
                      {updateDespachoMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                      ) : (
                        <><Save className="mr-2 h-4 w-4" />Actualizar</>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => saveDespachoMutation.mutate()}
                      disabled={saveDespachoMutation.isPending}
                      data-testid="button-save-despacho"
                    >
                      {saveDespachoMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                      ) : (
                        <><Save className="mr-2 h-4 w-4" />Guardar</>
                      )}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSavedDespachos(!showSavedDespachos)}
                    data-testid="button-show-saved"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {showSavedDespachos ? "Ocultar" : "Cargar Guardados"}
                  </Button>
                </div>
              )}

              {showSavedDespachos && savedDespachos.length > 0 && (
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Despachos Guardados</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {savedDespachos.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/50">
                          <div className="flex-1">
                            <span className="font-medium text-sm">{d.nombre}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({d.totalRows} filas, {d.validRows} OK, {d.errorRows} errores)
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => loadDespacho(d.id)}
                              data-testid={`button-load-${d.id}`}
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteDespachoMutation.mutate(d.id)}
                              data-testid={`button-delete-${d.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Resultados de Validación</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedRows.size} seleccionadas | {successfulRowsCount} exitosas de {rows.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllSuccessful}
                    data-testid="button-select-successful"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Seleccionar Exitosas
                  </Button>
                  {selectedRows.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      Limpiar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortOrder === "default") setSortOrder("success_first");
                      else if (sortOrder === "success_first") setSortOrder("errors_first");
                      else setSortOrder("default");
                    }}
                    data-testid="button-sort"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    {sortOrder === "default" ? "Ordenar" : sortOrder === "success_first" ? "Exitosas ↑" : "Errores ↑"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-center p-3 font-medium w-10">
                          <input
                            type="checkbox"
                            checked={selectedRows.size === rows.length && rows.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRows(new Set(rows.map((_, i) => i)));
                              } else {
                                setSelectedRows(new Set());
                              }
                            }}
                            className="h-4 w-4"
                            data-testid="checkbox-select-all"
                          />
                        </th>
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
                        <th className="text-left p-3 font-medium">Cap.</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Cédula</th>
                        <th className="text-left p-3 font-medium">Lic.</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Ton</th>
                        <th className="text-left p-3 font-medium">Flete</th>
                        <th className="text-left p-3 font-medium">Valor</th>
                        <th className="text-left p-3 font-medium">H.Carg</th>
                        <th className="text-left p-3 font-medium">H.Desc</th>
                        <th className="text-left p-3 font-medium">Fecha</th>
                        <th className="text-left p-3 font-medium">Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map(({ row, originalIndex }) => (
                        <tr 
                          key={originalIndex} 
                          className={`border-t ${row.errors.length > 0 ? "bg-red-50" : ""} ${selectedRows.has(originalIndex) ? "bg-blue-50" : ""}`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(originalIndex)}
                              onChange={() => toggleRowSelection(originalIndex)}
                              className="h-4 w-4"
                              data-testid={`checkbox-row-${originalIndex}`}
                            />
                          </td>
                          <td className="p-3 text-muted-foreground">{originalIndex + 1}</td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.granja}
                              onChange={(e) => updateRow(originalIndex, "granja", e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded bg-background"
                              data-testid={`input-granja-${originalIndex}`}
                            />
                          </td>
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
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.planta}
                              onChange={(e) => updateRow(originalIndex, "planta", e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded bg-background"
                              data-testid={`input-planta-${originalIndex}`}
                            />
                          </td>
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
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.placa}
                              onChange={(e) => updateRow(originalIndex, "placa", e.target.value.toUpperCase())}
                              className="w-20 px-2 py-1 text-sm border rounded bg-background font-mono"
                              data-testid={`input-placa-${originalIndex}`}
                            />
                          </td>
                          <td className="p-3 text-xs">{row.placaData?.propietarioId || "-"}</td>
                          <td className="p-3 text-xs">{row.placaData?.venceSoat || "-"}</td>
                          <td className="p-3 text-xs">{row.placaData?.capacidad || "-"}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.placaValid)}</td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.cedula}
                              onChange={(e) => updateRow(originalIndex, "cedula", e.target.value)}
                              className="w-28 px-2 py-1 text-sm border rounded bg-background"
                              data-testid={`input-cedula-${originalIndex}`}
                            />
                          </td>
                          <td className="p-3 text-xs">{row.cedulaData?.venceLicencia || "-"}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.cedulaValid)}</td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.toneladas}
                              onChange={(e) => updateRow(originalIndex, "toneladas", e.target.value)}
                              className="w-16 px-2 py-1 text-sm border rounded bg-background"
                              data-testid={`input-toneladas-${originalIndex}`}
                            />
                          </td>
                          <td className="p-3 text-xs">{row.granjaData?.flete || "-"}</td>
                          <td className="p-3 font-medium text-green-700">
                            {row.granjaData?.flete && row.toneladas
                              ? Math.round(parseFloat(row.toneladas.replace(",", ".")) * parseFloat(row.granjaData.flete.replace(/[^\d.-]/g, "")))
                              : "-"}
                          </td>
                          <td className="p-3 text-xs">{row.horaCargue || "-"}</td>
                          <td className="p-3 text-xs">{row.horaDescargue || "-"}</td>
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
