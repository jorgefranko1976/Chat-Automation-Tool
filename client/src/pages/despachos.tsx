import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, Database, Car, User, RefreshCw, Save, FolderOpen, Trash2, ArrowUpDown, CheckSquare, Square, FileCode, Eye, History, FileText, RotateCcw, RefreshCcw, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getMunicipioName, formatValorQR } from "@/lib/municipios";

interface DespachoRow {
  granja: string;
  planta: string;
  placa: string;
  cedula: string;
  toneladas: string;
  fecha: string;
  granjaValid: boolean | null;
  granjaData: { sede: string; codMunicipio: string; flete: string } | null;
  plantaValid: boolean | null;
  plantaData: { sede: string; codMunicipio: string } | null;
  placaValid: boolean | null;
  placaData: { tipoIdPropietario?: string; propietarioId: string; venceSoat: string; pesoVacio: string; capacidad?: string } | null;
  cedulaValid: boolean | null;
  cedulaData: { venceLicencia: string; nombre?: string } | null;
  horaCargue?: string;
  horaDescargue?: string;
  errors: string[];
}

interface GeneratedRemesa {
  consecutivo: number;
  placa: string;
  cantidadCargada: string;
  fechaCargue: string;
  horaCargue: string;
  fechaDescargue: string;
  horaDescargue: string;
  sedeRemitente?: string;
  sedeDestinatario?: string;
  xmlRequest: string;
  status: "pending" | "processing" | "success" | "error";
  responseCode?: string;
  responseMessage?: string;
  idRemesa?: string;
  // Data needed for manifiesto
  codMunicipioOrigen?: string;
  codMunicipioDestino?: string;
  tipoIdPropietario?: string;
  numIdPropietario?: string;
  cedula?: string;
  valorFlete?: number;
  fecha?: string;
}

interface GeneratedManifiesto {
  consecutivo: number;
  placa: string;
  fechaExpedicion: string;
  codMunicipioOrigen: string;
  codMunicipioDestino: string;
  tipoIdTitular: string;
  numIdTitular: string;
  cedula: string;
  valorFlete: number;
  fechaPagoSaldo: string;
  consecutivoRemesa: number;
  xmlRequest: string;
  status: "pending" | "processing" | "success" | "error";
  responseCode?: string;
  responseMessage?: string;
  idManifiesto?: string;
}

export default function Despachos() {
  const { toast } = useToast();
  const { settings, saveSettings } = useSettings();
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
  const [generatedRemesas, setGeneratedRemesas] = useState<GeneratedRemesa[]>([]);
  const [generatedManifiestos, setGeneratedManifiestos] = useState<GeneratedManifiesto[]>([]);
  const [isSendingRemesas, setIsSendingRemesas] = useState(false);
  const [isSendingManifiestos, setIsSendingManifiestos] = useState(false);
  const [manifestoProgress, setManifiestoProgress] = useState({ total: 0, processed: 0, success: 0, error: 0 });
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [showRemesasHistory, setShowRemesasHistory] = useState(false);
  const [stepDComplete, setStepDComplete] = useState(false);
  const [selectedHistoryRemesas, setSelectedHistoryRemesas] = useState<Set<string>>(new Set());
  const [selectedManifestosForPdf, setSelectedManifestosForPdf] = useState<Set<number>>(new Set());
  const [isGeneratingBulkPdfs, setIsGeneratingBulkPdfs] = useState(false);
  const [retryingManifiestoIndex, setRetryingManifiestoIndex] = useState<number | null>(null);
  const [isRetryingAllFailed, setIsRetryingAllFailed] = useState(false);
  const [manualUpdateDialog, setManualUpdateDialog] = useState<{ open: boolean; index: number | null; consecutivo: number | null }>({ open: false, index: null, consecutivo: null });
  const [manualUpdateXml, setManualUpdateXml] = useState("");
  const [despachoSearch, setDespachoSearch] = useState("");
  const [despachoPage, setDespachoPage] = useState(1);
  const despachosPerPage = 10;

  const { data: remesasHistoryData, refetch: refetchRemesasHistory } = useQuery({
    queryKey: ["/api/rndc/remesas/history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/rndc/remesas/history?limit=100");
      return res.json();
    },
    enabled: showRemesasHistory,
  });

  const remesasHistory = remesasHistoryData?.submissions || [];

  const { data: savedDespachosData, refetch: refetchDespachos } = useQuery({
    queryKey: ["/api/despachos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/despachos");
      return res.json();
    },
  });

  const savedDespachos = savedDespachosData?.despachos || [];

  // Filter and paginate saved despachos
  const filteredDespachos = savedDespachos.filter((d: any) => {
    if (!despachoSearch.trim()) return true;
    const search = despachoSearch.toLowerCase();
    return (
      d.nombre?.toLowerCase().includes(search) ||
      d.fecha?.toLowerCase().includes(search) ||
      d.status?.toLowerCase().includes(search)
    );
  });
  const totalDespachoPages = Math.ceil(filteredDespachos.length / despachosPerPage);
  const paginatedDespachos = filteredDespachos.slice(
    (despachoPage - 1) * despachosPerPage,
    despachoPage * despachosPerPage
  );

  const saveDespachoMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const nombre = `Despacho ${today} - ${rows.length} filas`;
      const response = await apiRequest("POST", "/api/despachos", {
        nombre,
        fecha: today,
        rows,
        remesas: generatedRemesas,
        manifiestos: generatedManifiestos,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentDespachoId(data.despacho.id);
      refetchDespachos();
      toast({ title: "Guardado", description: "Despacho completo guardado correctamente (filas, remesas y manifiestos)" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el despacho", variant: "destructive" });
    },
  });

  const updateDespachoMutation = useMutation({
    mutationFn: async () => {
      if (!currentDespachoId) throw new Error("No hay despacho seleccionado");
      
      // Determine status based on what's included
      let status = "draft";
      if (generatedRemesas.length > 0 && generatedManifiestos.length > 0) {
        status = "completed";
      } else if (generatedRemesas.length > 0) {
        status = "remesas_sent";
      }
      
      const response = await apiRequest("PUT", `/api/despachos/${currentDespachoId}`, { 
        rows,
        remesas: generatedRemesas,
        manifiestos: generatedManifiestos,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchDespachos();
      toast({ title: "Actualizado", description: "Despacho actualizado correctamente (incluye remesas y manifiestos)" });
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
        
        // Restore remesas if available
        if (data.despacho.remesas && Array.isArray(data.despacho.remesas)) {
          setGeneratedRemesas(data.despacho.remesas);
        }
        
        // Restore manifiestos if available
        if (data.despacho.manifiestos && Array.isArray(data.despacho.manifiestos)) {
          setGeneratedManifiestos(data.despacho.manifiestos);
        }
        
        const hasRemesas = data.despacho.remesas?.length > 0;
        const hasManifiestos = data.despacho.manifiestos?.length > 0;
        let statusMsg = "";
        if (hasManifiestos && hasRemesas) {
          statusMsg = " (incluye remesas y manifiestos)";
        } else if (hasRemesas) {
          statusMsg = " (incluye remesas)";
        }
        
        toast({ title: "Cargado", description: `Despacho "${data.despacho.nombre}" cargado${statusMsg}` });
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
        COD_MUNICIPIO_DESTINO: row.granjaData?.codMunicipio || "",
        PLANTA: row.planta,
        PLANTA_SEDE: row.plantaData?.sede || "",
        COD_MUNICIPIO_ORIGEN: row.plantaData?.codMunicipio || "",
        PLACA: row.placa,
        TIPOIDPROPIETARIO: row.placaData?.tipoIdPropietario || "",
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

  const handleExportManifiestosExcel = () => {
    if (generatedManifiestos.length === 0) return;
    
    const exportData = generatedManifiestos.map((m) => ({
      CONSECUTIVO: m.consecutivo,
      PLACA: m.placa,
      COD_MUNICIPIO_ORIGEN: m.codMunicipioOrigen,
      COD_MUNICIPIO_DESTINO: m.codMunicipioDestino,
      CEDULA_CONDUCTOR: m.cedula,
      VALOR_FLETE: m.valorFlete,
      FECHA_PAGO_SALDO: m.fechaPagoSaldo,
      ESTADO: m.status === "success" ? "EXITOSO" : m.status === "error" ? "ERROR" : "PENDIENTE",
      ID_MANIFIESTO: m.idManifiesto || "",
      RESPUESTA: m.responseMessage || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manifiestos");
    XLSX.writeFile(wb, `manifiestos_${new Date().toISOString().split("T")[0]}.xlsx`);
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

  const generateRemesasXml = () => {
    if (selectedRows.size === 0) {
      toast({ title: "Error", description: "Seleccione al menos una fila para generar Remesas", variant: "destructive" });
      return;
    }

    // Validate that all 3 steps are complete
    if (!stepAComplete || !stepBComplete || !stepCComplete) {
      toast({ 
        title: "Validación incompleta", 
        description: "Complete los 3 pasos de validación (A: Interno, B: Placas, C: Cédulas) antes de generar remesas", 
        variant: "destructive" 
      });
      return;
    }

    // Check for rows with errors
    const selectedRowsArray = Array.from(selectedRows).map(idx => rows[idx]).filter(r => r);
    const rowsWithErrors = selectedRowsArray.filter(r => r.errors && r.errors.length > 0);
    if (rowsWithErrors.length > 0) {
      toast({ 
        title: "Filas con errores", 
        description: `${rowsWithErrors.length} filas seleccionadas tienen errores. Corrija antes de generar remesas.`, 
        variant: "destructive" 
      });
      return;
    }

    if (!settings.usernameRndc || !settings.passwordRndc || !settings.companyNit) {
      toast({ title: "Error", description: "Configure credenciales RNDC en Configuración", variant: "destructive" });
      return;
    }

    if (!settings.numIdGps) {
      toast({ title: "Error", description: "Configure el ID GPS en Configuración > Datos de la Empresa", variant: "destructive" });
      return;
    }

    let currentConsecutivo = settings.consecutivo;
    const remesas: GeneratedRemesa[] = [];

    for (const row of selectedRowsArray) {
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<root>
  <acceso>
    <username>${settings.usernameRndc}</username>
    <password>${settings.passwordRndc}</password>
  </acceso>
  <solicitud>
    <tipo>1</tipo>
    <procesoid>3</procesoid>
  </solicitud>
  <variables>
    <NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
    <CONSECUTIVOREMESA>${currentConsecutivo}</CONSECUTIVOREMESA>
    <CODOPERACIONTRANSPORTE>G</CODOPERACIONTRANSPORTE>
    <CODNATURALEZACARGA>1</CODNATURALEZACARGA>
    <CANTIDADCARGADA>${row.placaData?.capacidad || row.toneladas}</CANTIDADCARGADA>
    <UNIDADMEDIDACAPACIDAD>1</UNIDADMEDIDACAPACIDAD>
    <CODTIPOEMPAQUE>0</CODTIPOEMPAQUE>
    <MERCANCIAREMESA>002309</MERCANCIAREMESA>
    <DESCRIPCIONCORTAPRODUCTO>ALIMENTO PARA AVES DE CORRAL</DESCRIPCIONCORTAPRODUCTO>
    <CODTIPOIDREMITENTE>N</CODTIPOIDREMITENTE>
    <NUMIDREMITENTE>8600588314</NUMIDREMITENTE>
    <CODSEDEREMITENTE>${row.plantaData?.sede || ""}</CODSEDEREMITENTE>
    <CODTIPOIDDESTINATARIO>N</CODTIPOIDDESTINATARIO>
    <NUMIDDESTINATARIO>8600588314</NUMIDDESTINATARIO>
    <CODSEDEDESTINATARIO>${row.granjaData?.sede || ""}</CODSEDEDESTINATARIO>
    <DUENOPOLIZA>N</DUENOPOLIZA>
    <HORASPACTOCARGA>2</HORASPACTOCARGA>
    <HORASPACTODESCARGUE>2</HORASPACTODESCARGUE>
    <CODTIPOIDPROPIETARIO>N</CODTIPOIDPROPIETARIO>
    <NUMIDPROPIETARIO>${settings.companyNit}</NUMIDPROPIETARIO>
    <CODSEDEPROPIETARIO>01</CODSEDEPROPIETARIO>
    <FECHACITAPACTADACARGUE>${row.fecha}</FECHACITAPACTADACARGUE>
    <HORACITAPACTADACARGUE>${row.horaCargue || "08:00"}</HORACITAPACTADACARGUE>
    <FECHACITAPACTADADESCARGUE>${row.fecha}</FECHACITAPACTADADESCARGUE>
    <HORACITAPACTADADESCARGUEREMESA>${row.horaDescargue || "13:00"}</HORACITAPACTADADESCARGUEREMESA>
    <NUMIDGPS>${settings.numIdGps}</NUMIDGPS>
  </variables>
</root>`;
      
      const ton = parseFloat(row.toneladas.replace(",", ".")) || 0;
      const flete = parseFloat((row.granjaData?.flete || "").replace(/[^\d.-]/g, "")) || 0;
      const valorFlete = Math.round(ton * flete);
      
      remesas.push({
        consecutivo: currentConsecutivo,
        placa: row.placa,
        cantidadCargada: row.placaData?.capacidad || row.toneladas,
        fechaCargue: row.fecha,
        horaCargue: row.horaCargue || "08:00",
        fechaDescargue: row.fecha,
        horaDescargue: row.horaDescargue || "13:00",
        sedeRemitente: row.plantaData?.sede,
        sedeDestinatario: row.granjaData?.sede,
        xmlRequest: xml,
        status: "pending",
        // Data for manifiesto
        codMunicipioOrigen: row.plantaData?.codMunicipio,
        codMunicipioDestino: row.granjaData?.codMunicipio,
        tipoIdPropietario: row.placaData?.tipoIdPropietario || "C",
        numIdPropietario: row.placaData?.propietarioId,
        cedula: row.cedula.replace(/[^\d]/g, ""),
        valorFlete,
        fecha: row.fecha,
      });
      currentConsecutivo++;
    }

    setGeneratedRemesas(remesas);
    saveSettings({ ...settings, consecutivo: currentConsecutivo });

    toast({ 
      title: "XMLs Generados", 
      description: `${remesas.length} remesas listas para enviar. Consecutivo actualizado a ${currentConsecutivo}` 
    });
  };

  const handleDownloadRemesas = () => {
    if (generatedRemesas.length === 0) return;
    const allXml = generatedRemesas.map(r => r.xmlRequest).join("\n\n<!-- ==================== SIGUIENTE REMESA ==================== -->\n\n");
    const blob = new Blob([allXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remesas_${new Date().toISOString().split("T")[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearGeneratedRemesas = () => {
    setGeneratedRemesas([]);
    setGeneratedManifiestos([]);
  };

  const addDays = (dateStr: string, days: number): string => {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      date.setDate(date.getDate() + days);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    }
    return dateStr;
  };

  const generateManifiestosXml = () => {
    const successRemesas = generatedRemesas.filter(r => r.status === "success");
    if (successRemesas.length === 0) {
      toast({ title: "Error", description: "No hay remesas exitosas para generar manifiestos", variant: "destructive" });
      return;
    }

    if (!settings.usernameRndc || !settings.passwordRndc || !settings.companyNit) {
      toast({ title: "Error", description: "Configure credenciales RNDC en Configuración", variant: "destructive" });
      return;
    }

    // Find remesas that don't already have a manifest
    const existingConsecutivos = new Set(generatedManifiestos.map(m => m.consecutivoRemesa));
    const remesasWithoutManifest = successRemesas.filter(r => !existingConsecutivos.has(r.consecutivo));
    
    if (remesasWithoutManifest.length === 0) {
      toast({ title: "Info", description: "Todas las remesas exitosas ya tienen manifiesto generado" });
      return;
    }

    const newManifiestos: GeneratedManifiesto[] = [];

    for (const remesa of remesasWithoutManifest) {
      const fechaPagoSaldo = addDays(remesa.fecha || remesa.fechaCargue, 5);
      
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<root>
  <acceso>
    <username>${settings.usernameRndc}</username>
    <password>${settings.passwordRndc}</password>
  </acceso>
  <solicitud>
    <tipo>1</tipo>
    <procesoid>4</procesoid>
  </solicitud>
  <variables>
    <NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
    <NUMMANIFIESTOCARGA>${remesa.consecutivo}</NUMMANIFIESTOCARGA>
    <CODOPERACIONTRANSPORTE>G</CODOPERACIONTRANSPORTE>
    <FECHAEXPEDICIONMANIFIESTO>${remesa.fecha || remesa.fechaCargue}</FECHAEXPEDICIONMANIFIESTO>
    <CODMUNICIPIOORIGENMANIFIESTO>${remesa.codMunicipioOrigen || ""}</CODMUNICIPIOORIGENMANIFIESTO>
    <CODMUNICIPIODESTINOMANIFIESTO>${remesa.codMunicipioDestino || ""}</CODMUNICIPIODESTINOMANIFIESTO>
    <CODIDTITULARMANIFIESTO>${remesa.tipoIdPropietario || "C"}</CODIDTITULARMANIFIESTO>
    <NUMIDTITULARMANIFIESTO>${remesa.numIdPropietario || ""}</NUMIDTITULARMANIFIESTO>
    <NUMPLACA>${remesa.placa}</NUMPLACA>
    <CODIDCONDUCTOR>C</CODIDCONDUCTOR>
    <NUMIDCONDUCTOR>${remesa.cedula || ""}</NUMIDCONDUCTOR>
    <VALORFLETEPACTADOVIAJE>${remesa.valorFlete || 0}</VALORFLETEPACTADOVIAJE>
    <RETENCIONICAMANIFIESTOCARGA>0</RETENCIONICAMANIFIESTOCARGA>
    <VALORANTICIPOMANIFIESTO>0</VALORANTICIPOMANIFIESTO>
    <CODMUNICIPIOPAGOSALDO>11001000</CODMUNICIPIOPAGOSALDO>
    <FECHAPAGOSALDOMANIFIESTO>${fechaPagoSaldo}</FECHAPAGOSALDOMANIFIESTO>
    <CODRESPONSABLEPAGOCARGUE>D</CODRESPONSABLEPAGOCARGUE>
    <CODRESPONSABLEPAGODESCARGUE>D</CODRESPONSABLEPAGODESCARGUE>
    <ACEPTACIONELECTRONICA>SI</ACEPTACIONELECTRONICA>
    <REMESASMAN procesoid="43">
      <REMESA>
        <CONSECUTIVOREMESA>${remesa.consecutivo}</CONSECUTIVOREMESA>
      </REMESA>
    </REMESASMAN>
  </variables>
</root>`;

      newManifiestos.push({
        consecutivo: remesa.consecutivo,
        placa: remesa.placa,
        fechaExpedicion: remesa.fecha || remesa.fechaCargue,
        codMunicipioOrigen: remesa.codMunicipioOrigen || "",
        codMunicipioDestino: remesa.codMunicipioDestino || "",
        tipoIdTitular: remesa.tipoIdPropietario || "C",
        numIdTitular: remesa.numIdPropietario || "",
        cedula: remesa.cedula || "",
        valorFlete: remesa.valorFlete || 0,
        fechaPagoSaldo,
        consecutivoRemesa: remesa.consecutivo,
        xmlRequest: xml,
        status: "pending",
      });
    }

    // Append new manifests to existing ones
    setGeneratedManifiestos(prev => [...prev, ...newManifiestos]);
    toast({
      title: "Manifiestos Generados",
      description: `${newManifiestos.length} nuevo(s) manifiesto(s) agregado(s). Total: ${generatedManifiestos.length + newManifiestos.length}`
    });
  };

  const generateManifiestosFromHistory = () => {
    if (selectedHistoryRemesas.size === 0) {
      toast({ title: "Error", description: "Seleccione al menos una remesa del historial", variant: "destructive" });
      return;
    }

    if (!settings.usernameRndc || !settings.passwordRndc || !settings.companyNit) {
      toast({ title: "Error", description: "Configure credenciales RNDC en Configuración", variant: "destructive" });
      return;
    }

    const selectedRemesas = remesasHistory.filter((r: any) => 
      selectedHistoryRemesas.has(r.id) && r.status === "success"
    );

    if (selectedRemesas.length === 0) {
      toast({ title: "Error", description: "Solo se pueden generar manifiestos de remesas exitosas", variant: "destructive" });
      return;
    }

    const manifiestos: GeneratedManifiesto[] = [];

    for (const remesa of selectedRemesas) {
      const fechaBase = remesa.fechaCargue || new Date().toLocaleDateString("es-CO");
      const fechaPagoSaldo = addDays(fechaBase, 5);
      
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<root>
  <acceso>
    <username>${settings.usernameRndc}</username>
    <password>${settings.passwordRndc}</password>
  </acceso>
  <solicitud>
    <tipo>1</tipo>
    <procesoid>4</procesoid>
  </solicitud>
  <variables>
    <NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
    <NUMMANIFIESTOCARGA>${remesa.consecutivoRemesa}</NUMMANIFIESTOCARGA>
    <CODOPERACIONTRANSPORTE>G</CODOPERACIONTRANSPORTE>
    <FECHAEXPEDICIONMANIFIESTO>${fechaBase}</FECHAEXPEDICIONMANIFIESTO>
    <CODMUNICIPIOORIGENMANIFIESTO>${remesa.codMunicipioOrigen || ""}</CODMUNICIPIOORIGENMANIFIESTO>
    <CODMUNICIPIODESTINOMANIFIESTO>${remesa.codMunicipioDestino || ""}</CODMUNICIPIODESTINOMANIFIESTO>
    <CODIDTITULARMANIFIESTO>${remesa.tipoIdPropietario || "C"}</CODIDTITULARMANIFIESTO>
    <NUMIDTITULARMANIFIESTO>${remesa.numIdPropietario || settings.companyNit}</NUMIDTITULARMANIFIESTO>
    <NUMPLACA>${remesa.numPlaca}</NUMPLACA>
    <CODIDCONDUCTOR>C</CODIDCONDUCTOR>
    <NUMIDCONDUCTOR>${remesa.cedula || ""}</NUMIDCONDUCTOR>
    <VALORFLETEPACTADOVIAJE>${remesa.valorFlete || 0}</VALORFLETEPACTADOVIAJE>
    <RETENCIONICAMANIFIESTOCARGA>0</RETENCIONICAMANIFIESTOCARGA>
    <VALORANTICIPOMANIFIESTO>0</VALORANTICIPOMANIFIESTO>
    <CODMUNICIPIOPAGOSALDO>11001000</CODMUNICIPIOPAGOSALDO>
    <FECHAPAGOSALDOMANIFIESTO>${fechaPagoSaldo}</FECHAPAGOSALDOMANIFIESTO>
    <CODRESPONSABLEPAGOCARGUE>D</CODRESPONSABLEPAGOCARGUE>
    <CODRESPONSABLEPAGODESCARGUE>D</CODRESPONSABLEPAGODESCARGUE>
    <ACEPTACIONELECTRONICA>SI</ACEPTACIONELECTRONICA>
    <REMESASMAN procesoid="43">
      <REMESA>
        <CONSECUTIVOREMESA>${remesa.consecutivoRemesa}</CONSECUTIVOREMESA>
      </REMESA>
    </REMESASMAN>
  </variables>
</root>`;

      manifiestos.push({
        consecutivo: parseInt(remesa.consecutivoRemesa),
        placa: remesa.numPlaca,
        fechaExpedicion: fechaBase,
        codMunicipioOrigen: remesa.codMunicipioOrigen || "",
        codMunicipioDestino: remesa.codMunicipioDestino || "",
        tipoIdTitular: remesa.tipoIdPropietario || "C",
        numIdTitular: remesa.numIdPropietario || settings.companyNit,
        cedula: remesa.cedula || "",
        valorFlete: remesa.valorFlete || 0,
        fechaPagoSaldo,
        consecutivoRemesa: parseInt(remesa.consecutivoRemesa),
        xmlRequest: xml,
        status: "pending",
      });
    }

    setGeneratedManifiestos(manifiestos);
    setSelectedHistoryRemesas(new Set());
    toast({
      title: "Manifiestos Generados",
      description: `${manifiestos.length} manifiestos listos para enviar desde historial`
    });
  };

  const toggleHistoryRemesaSelection = (id: string) => {
    const newSet = new Set(selectedHistoryRemesas);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedHistoryRemesas(newSet);
  };

  const selectAllSuccessfulHistory = () => {
    const successIds = remesasHistory
      .filter((r: any) => r.status === "success")
      .map((r: any) => r.id);
    setSelectedHistoryRemesas(new Set(successIds));
  };

  const handleDownloadManifiestos = () => {
    if (generatedManifiestos.length === 0) return;
    const allXml = generatedManifiestos.map(m => m.xmlRequest).join("\n\n<!-- ==================== SIGUIENTE MANIFIESTO ==================== -->\n\n");
    const blob = new Blob([allXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifiestos_${new Date().toISOString().split("T")[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendManifiestos = async () => {
    if (generatedManifiestos.length === 0) return;

    setIsSendingManifiestos(true);
    // Initialize progress tracking
    const pendingCount = generatedManifiestos.filter(m => m.status === "pending").length;
    setManifiestoProgress({ total: pendingCount, processed: 0, success: 0, error: 0 });

    try {
      const wsUrl = settings.wsEnvironment === "production"
        ? settings.wsUrlProd
        : settings.wsUrlTest;

      const submissions = generatedManifiestos.map(m => ({
        consecutivoManifiesto: String(m.consecutivo),
        numNitEmpresa: settings.companyNit,
        numPlaca: m.placa,
        xmlRequest: m.xmlRequest,
      }));

      const response = await apiRequest("POST", "/api/rndc/manifiesto-batch", {
        submissions,
        wsUrl,
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: "Enviando", description: result.message });
        pollManifiestoResults(result.batchId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSendingManifiestos(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Error al enviar manifiestos", variant: "destructive" });
      setIsSendingManifiestos(false);
    }
  };

  const pollManifiestoResults = async (batchId: string) => {
    try {
      const response = await apiRequest("GET", `/api/rndc/manifiesto-batch/${batchId}/results`);
      const result = await response.json();

      // Update progress with partial results if available
      if (result.results && result.results.length > 0) {
        const processed = result.results.length;
        const successCount = result.results.filter((r: any) => r.success).length;
        const errorCount = result.results.filter((r: any) => !r.success && r.responseCode).length;
        setManifiestoProgress(prev => ({
          ...prev,
          processed,
          success: successCount,
          error: errorCount
        }));

        // Update individual manifest statuses in real-time
        setGeneratedManifiestos(prev => prev.map(m => {
          const submissionResult = result.results?.find((r: any) => String(r.consecutivoManifiesto) === String(m.consecutivo));
          if (submissionResult && submissionResult.responseCode) {
            let extractedId = submissionResult.idManifiesto;
            if (!extractedId && submissionResult.responseMessage) {
              const idMatch = submissionResult.responseMessage.match(/IngresoID:\s*(\d+)/i);
              if (idMatch) extractedId = idMatch[1];
            }
            if (!extractedId && submissionResult.responseCode && /^\d+$/.test(submissionResult.responseCode)) {
              extractedId = submissionResult.responseCode;
            }
            return {
              ...m,
              status: submissionResult.success ? "success" as const : "error" as const,
              responseCode: submissionResult.responseCode,
              responseMessage: submissionResult.responseMessage,
              idManifiesto: extractedId,
            };
          }
          return m;
        }));
      }

      if (result.completed) {
        setIsSendingManifiestos(false);
        setStepDComplete(true);

        const finalSuccess = result.results?.filter((r: any) => r.success).length || 0;
        const finalTotal = result.results?.length || 0;
        toast({
          title: "Manifiestos Procesados",
          description: `${finalSuccess}/${finalTotal} manifiestos enviados exitosamente`
        });
      } else {
        setTimeout(() => pollManifiestoResults(batchId), 2000);
      }
    } catch {
      setIsSendingManifiestos(false);
    }
  };

  const retrySingleManifiesto = async (index: number) => {
    setRetryingManifiestoIndex(index);
    
    // Get current manifest state using functional approach
    let currentManifiesto: GeneratedManifiesto | null = null;
    setGeneratedManifiestos(prev => {
      currentManifiesto = prev[index];
      if (!currentManifiesto || currentManifiesto.status !== "error") return prev;
      const updated = [...prev];
      updated[index] = { ...currentManifiesto, status: "processing" as const };
      return updated;
    });
    
    if (!currentManifiesto) {
      setRetryingManifiestoIndex(null);
      return;
    }
    
    const manifiesto = currentManifiesto as GeneratedManifiesto;
    
    try {
      const wsUrl = settings.wsEnvironment === "production"
        ? settings.wsUrlProd
        : settings.wsUrlTest;

      const response = await apiRequest("POST", "/api/rndc/manifiesto-batch", {
        submissions: [{
          consecutivoManifiesto: String(manifiesto.consecutivo),
          numNitEmpresa: settings.companyNit,
          numPlaca: manifiesto.placa,
          xmlRequest: manifiesto.xmlRequest,
        }],
        wsUrl,
      });

      const result = await response.json();
      
      if (result.success && result.batchId) {
        await pollSingleManifiestoResult(result.batchId, index, manifiesto.consecutivo);
      } else {
        setGeneratedManifiestos(prev => {
          const updated = [...prev];
          updated[index] = { ...prev[index], status: "error" as const, responseMessage: result.message || "Error al reintentar" };
          return updated;
        });
        toast({ title: "Error", description: result.message || "Error al reintentar manifiesto", variant: "destructive" });
      }
    } catch (error) {
      setGeneratedManifiestos(prev => {
        const updated = [...prev];
        updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Error de conexión al reintentar" };
        return updated;
      });
      toast({ title: "Error", description: "Error al reintentar manifiesto", variant: "destructive" });
    } finally {
      setRetryingManifiestoIndex(null);
    }
  };

  const pollSingleManifiestoResult = async (batchId: string, index: number, consecutivo: number, attempts = 0): Promise<void> => {
    if (attempts >= 30) {
      setGeneratedManifiestos(prev => {
        const updated = [...prev];
        updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Tiempo de espera agotado" };
        return updated;
      });
      toast({ title: "Error", description: "Tiempo de espera agotado para el reintento", variant: "destructive" });
      return;
    }
    
    try {
      const response = await apiRequest("GET", `/api/rndc/manifiesto-batch/${batchId}/results`);
      const result = await response.json();

      if (result.completed) {
        const submissionResult = result.results?.[0];
        
        if (submissionResult) {
          let extractedId = submissionResult.idManifiesto;
          if (!extractedId && submissionResult.responseMessage) {
            const idMatch = submissionResult.responseMessage.match(/IngresoID:\s*(\d+)/i);
            if (idMatch) extractedId = idMatch[1];
          }
          if (!extractedId && submissionResult.responseCode && /^\d+$/.test(submissionResult.responseCode)) {
            extractedId = submissionResult.responseCode;
          }
          
          setGeneratedManifiestos(prev => {
            const updated = [...prev];
            updated[index] = {
              ...prev[index],
              status: submissionResult.success ? "success" as const : "error" as const,
              responseCode: submissionResult.responseCode,
              responseMessage: submissionResult.responseMessage,
              idManifiesto: extractedId,
            };
            return updated;
          });
          
          if (submissionResult.success) {
            toast({ title: "Reintento Exitoso", description: `Manifiesto ${consecutivo} enviado correctamente` });
          } else {
            toast({ title: "Error", description: submissionResult.responseMessage || "El reintento falló", variant: "destructive" });
          }
        } else {
          setGeneratedManifiestos(prev => {
            const updated = [...prev];
            updated[index] = { ...prev[index], status: "error" as const, responseMessage: "No se recibió respuesta del servidor" };
            return updated;
          });
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await pollSingleManifiestoResult(batchId, index, consecutivo, attempts + 1);
      }
    } catch {
      setGeneratedManifiestos(prev => {
        const updated = [...prev];
        updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Error consultando resultado" };
        return updated;
      });
      toast({ title: "Error", description: "Error consultando resultado del reintento", variant: "destructive" });
    }
  };

  const retryAllFailedManifiestos = async () => {
    // Capture failed indices and their data at the start
    const failedManifestosSnapshot: Array<{ index: number; manifiesto: GeneratedManifiesto }> = [];
    generatedManifiestos.forEach((m, i) => {
      if (m.status === "error") {
        failedManifestosSnapshot.push({ index: i, manifiesto: { ...m } });
      }
    });
    
    if (failedManifestosSnapshot.length === 0) {
      toast({ title: "Info", description: "No hay manifiestos fallidos para reintentar" });
      return;
    }
    
    setIsRetryingAllFailed(true);
    toast({ title: "Reintentando", description: `Reenviando ${failedManifestosSnapshot.length} manifiestos fallidos...` });
    
    let successCount = 0;
    let errorCount = 0;
    const wsUrl = settings.wsEnvironment === "production"
      ? settings.wsUrlProd
      : settings.wsUrlTest;
    
    for (const { index, manifiesto } of failedManifestosSnapshot) {
      try {
        // Mark as processing using functional setter
        setGeneratedManifiestos(prev => {
          const updated = [...prev];
          updated[index] = { ...prev[index], status: "processing" as const };
          return updated;
        });

        const response = await apiRequest("POST", "/api/rndc/manifiesto-batch", {
          submissions: [{
            consecutivoManifiesto: String(manifiesto.consecutivo),
            numNitEmpresa: settings.companyNit,
            numPlaca: manifiesto.placa,
            xmlRequest: manifiesto.xmlRequest,
          }],
          wsUrl,
        });

        const result = await response.json();
        
        if (result.success && result.batchId) {
          // Poll for result with timeout
          let completed = false;
          let attempts = 0;
          while (!completed && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              const pollRes = await apiRequest("GET", `/api/rndc/manifiesto-batch/${result.batchId}/results`);
              const pollResult = await pollRes.json();
              
              if (pollResult.completed) {
                completed = true;
                const submissionResult = pollResult.results?.[0];
                if (submissionResult) {
                  let extractedId = submissionResult.idManifiesto;
                  if (!extractedId && submissionResult.responseMessage) {
                    const idMatch = submissionResult.responseMessage.match(/IngresoID:\s*(\d+)/i);
                    if (idMatch) extractedId = idMatch[1];
                  }
                  if (!extractedId && submissionResult.responseCode && /^\d+$/.test(submissionResult.responseCode)) {
                    extractedId = submissionResult.responseCode;
                  }
                  
                  setGeneratedManifiestos(prev => {
                    const updated = [...prev];
                    updated[index] = {
                      ...prev[index],
                      status: submissionResult.success ? "success" as const : "error" as const,
                      responseCode: submissionResult.responseCode,
                      responseMessage: submissionResult.responseMessage,
                      idManifiesto: extractedId,
                    };
                    return updated;
                  });
                  
                  if (submissionResult.success) successCount++;
                  else errorCount++;
                } else {
                  // No submission result
                  setGeneratedManifiestos(prev => {
                    const updated = [...prev];
                    updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Sin respuesta del servidor" };
                    return updated;
                  });
                  errorCount++;
                }
              }
            } catch {
              // Polling error - continue trying
            }
            attempts++;
          }
          
          // Timeout - reset to error
          if (!completed) {
            setGeneratedManifiestos(prev => {
              const updated = [...prev];
              updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Tiempo de espera agotado" };
              return updated;
            });
            errorCount++;
          }
        } else {
          // Batch creation failed
          setGeneratedManifiestos(prev => {
            const updated = [...prev];
            updated[index] = { ...prev[index], status: "error" as const, responseMessage: result.message || "Error al reintentar" };
            return updated;
          });
          errorCount++;
        }
      } catch {
        // Request failed - reset to error
        setGeneratedManifiestos(prev => {
          const updated = [...prev];
          updated[index] = { ...prev[index], status: "error" as const, responseMessage: "Error de conexión" };
          return updated;
        });
        errorCount++;
      }
    }
    
    setIsRetryingAllFailed(false);
    toast({
      title: "Reintento Completado",
      description: `${successCount} exitosos, ${errorCount} fallidos de ${failedManifestosSnapshot.length} reintentos`
    });
  };

  const failedManifiestosCount = generatedManifiestos.filter(m => m.status === "error").length;

  const regenerateManifiestoXml = (index: number) => {
    const manifiesto = generatedManifiestos[index];
    if (!manifiesto) return;
    
    // Find the corresponding row in the Excel data by placa and cedula
    const normalizeCedula = (val: string) => val?.replace(/[.\-\s]/g, "") || "";
    const normalizedCedula = normalizeCedula(manifiesto.cedula);
    
    const matchingRow = rows.find(r => 
      r.placa?.toUpperCase() === manifiesto.placa?.toUpperCase() && 
      normalizeCedula(r.cedula) === normalizedCedula
    );
    
    if (!matchingRow) {
      toast({ 
        title: "Error", 
        description: "No se encontró la fila correspondiente en el Excel. Verifique que el Excel esté cargado con los datos actualizados.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!matchingRow.placaData) {
      toast({ 
        title: "Error", 
        description: "Falta validar la placa. Ejecute la validación antes de regenerar.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Get updated data from the row
    const tipoIdTitular = matchingRow.placaData.tipoIdPropietario || "C";
    const numIdTitular = matchingRow.placaData.propietarioId || "";
    
    // Find associated remesa for additional data
    const associatedRemesa = generatedRemesas.find(r => r.consecutivo === manifiesto.consecutivoRemesa);
    
    // Calculate valorFlete from row data - same logic as remesa generation (line 677-678)
    let valorFlete = associatedRemesa?.valorFlete || manifiesto.valorFlete;
    if (!valorFlete && matchingRow.granjaData?.flete) {
      // Use exact same normalization as remesa generation: keep digits, dots, minus
      const fletePerTon = parseFloat((matchingRow.granjaData.flete || "").replace(/[^\d.-]/g, "")) || 0;
      const toneladas = parseFloat(matchingRow.toneladas?.replace(",", ".") || "0") || 0;
      valorFlete = Math.round(toneladas * fletePerTon);
    }
    if (!valorFlete) valorFlete = 0;
    
    // Regenerate the XML with updated titular info
    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<root>
  <acceso>
    <username>${settings.usernameRndc}</username>
    <password>${settings.passwordRndc}</password>
  </acceso>
  <solicitud>
    <tipo>1</tipo>
    <procesoid>4</procesoid>
  </solicitud>
  <variables>
    <NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
    <NUMMANIFIESTOCARGA>${manifiesto.consecutivo}</NUMMANIFIESTOCARGA>
    <CODOPERACIONTRANSPORTE>G</CODOPERACIONTRANSPORTE>
    <FECHAEXPEDICIONMANIFIESTO>${manifiesto.fechaExpedicion}</FECHAEXPEDICIONMANIFIESTO>
    <CODMUNICIPIOORIGENMANIFIESTO>${manifiesto.codMunicipioOrigen}</CODMUNICIPIOORIGENMANIFIESTO>
    <CODMUNICIPIODESTINOMANIFIESTO>${manifiesto.codMunicipioDestino}</CODMUNICIPIODESTINOMANIFIESTO>
    <CODIDTITULARMANIFIESTO>${tipoIdTitular}</CODIDTITULARMANIFIESTO>
    <NUMIDTITULARMANIFIESTO>${numIdTitular}</NUMIDTITULARMANIFIESTO>
    <NUMPLACA>${manifiesto.placa}</NUMPLACA>
    <CODIDCONDUCTOR>C</CODIDCONDUCTOR>
    <NUMIDCONDUCTOR>${manifiesto.cedula}</NUMIDCONDUCTOR>
    <VALORFLETEPACTADOVIAJE>${valorFlete}</VALORFLETEPACTADOVIAJE>
    <RETENCIONICAMANIFIESTOCARGA>0</RETENCIONICAMANIFIESTOCARGA>
    <VALORANTICIPOMANIFIESTO>0</VALORANTICIPOMANIFIESTO>
    <CODMUNICIPIOPAGOSALDO>11001000</CODMUNICIPIOPAGOSALDO>
    <FECHAPAGOSALDOMANIFIESTO>${manifiesto.fechaPagoSaldo}</FECHAPAGOSALDOMANIFIESTO>
    <CODRESPONSABLEPAGOCARGUE>D</CODRESPONSABLEPAGOCARGUE>
    <CODRESPONSABLEPAGODESCARGUE>D</CODRESPONSABLEPAGODESCARGUE>
    <ACEPTACIONELECTRONICA>SI</ACEPTACIONELECTRONICA>
    <REMESASMAN procesoid="43">
      <REMESA>
        <CONSECUTIVOREMESA>${manifiesto.consecutivoRemesa}</CONSECUTIVOREMESA>
      </REMESA>
    </REMESASMAN>
  </variables>
</root>`;

    // Update the manifest with regenerated XML
    setGeneratedManifiestos(prev => {
      const updated = [...prev];
      updated[index] = {
        ...prev[index],
        tipoIdTitular,
        numIdTitular,
        valorFlete,
        xmlRequest: xml,
        status: "pending" as const,
        responseCode: undefined,
        responseMessage: undefined,
      };
      return updated;
    });
    
    toast({ 
      title: "XML Regenerado", 
      description: `Manifiesto ${manifiesto.consecutivo} actualizado. Titular: ${tipoIdTitular} ${numIdTitular}, Flete: $${valorFlete.toLocaleString()}. Listo para reintentar.` 
    });
  };

  const handleManualUpdateManifiesto = () => {
    if (manualUpdateDialog.index === null) return;
    
    try {
      // Parse the XML to extract ingresoid and seguridadqr
      let ingresoId = "";
      let seguridadQr = "";
      
      // Try to extract from XML
      const ingresoMatch = manualUpdateXml.match(/<ingresoid>(\d+)<\/ingresoid>/i);
      const qrMatch = manualUpdateXml.match(/<seguridadqr>([^<]+)<\/seguridadqr>/i);
      
      if (ingresoMatch) {
        ingresoId = ingresoMatch[1];
      }
      if (qrMatch) {
        seguridadQr = qrMatch[1];
      }
      
      if (!ingresoId) {
        toast({ title: "Error", description: "No se pudo extraer el ID del manifiesto del XML", variant: "destructive" });
        return;
      }
      
      // Update the manifest to success status
      setGeneratedManifiestos(prev => {
        const updated = [...prev];
        updated[manualUpdateDialog.index!] = {
          ...prev[manualUpdateDialog.index!],
          status: "success" as const,
          responseCode: ingresoId,
          responseMessage: `Actualizado manualmente. IngresoID: ${ingresoId}${seguridadQr ? `, QR: ${seguridadQr}` : ""}`,
          idManifiesto: ingresoId,
        };
        return updated;
      });
      
      toast({ 
        title: "Manifiesto Actualizado", 
        description: `Manifiesto ${manualUpdateDialog.consecutivo} actualizado exitosamente con ID: ${ingresoId}` 
      });
      
      setManualUpdateDialog({ open: false, index: null, consecutivo: null });
      setManualUpdateXml("");
    } catch (error) {
      toast({ title: "Error", description: "Error al procesar el XML", variant: "destructive" });
    }
  };

  const generateManifiestoPdf = async (manifiesto: GeneratedManifiesto) => {
    let manifiestoId = manifiesto.idManifiesto;
    if (!manifiestoId && manifiesto.responseMessage) {
      const idMatch = manifiesto.responseMessage.match(/IngresoID:\s*(\d+)/i);
      if (idMatch) manifiestoId = idMatch[1];
    }
    if (!manifiestoId && manifiesto.responseCode && /^\d+$/.test(manifiesto.responseCode)) {
      manifiestoId = manifiesto.responseCode;
    }
    
    if (manifiesto.status !== "success" || !manifiestoId) {
      toast({ title: "Error", description: "El manifiesto debe estar aprobado para generar PDF", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "Generando PDF", description: "Consultando datos del manifiesto..." });

      const wsUrl = settings.wsEnvironment === "production" ? settings.wsUrlProd : settings.wsUrlTest;

      const detailsResponse = await apiRequest("POST", "/api/rndc/manifiesto-details-enhanced", {
        username: settings.usernameRndc,
        password: settings.passwordRndc,
        companyNit: settings.companyNit,
        numManifiesto: String(manifiesto.consecutivo),
        numPlaca: manifiesto.placa,
        numIdConductor: manifiesto.cedula,
        numIdTitular: manifiesto.numIdTitular,
        wsUrl,
        companyName: settings.companyName || "TRANSPETROMIRA S.A.S",
        companyAddress: settings.companyAddress || "",
        companyPhone: settings.companyPhone || "",
        companyCity: settings.companyCity || "",
      });

      const detailsResult = await detailsResponse.json();
      
      if (!detailsResult.success || !detailsResult.details) {
        toast({ title: "Error", description: detailsResult.message || "No se pudieron obtener los datos", variant: "destructive" });
        return;
      }

      const details = detailsResult.details;
      const conductor = detailsResult.conductor;
      const titular = detailsResult.titular;
      const vehiculo = detailsResult.vehiculo;
      const vehiculoExtra = detailsResult.vehiculoExtra;
      
      const associatedRemesa = generatedRemesas.find(r => r.consecutivo === manifiesto.consecutivoRemesa);
      
      const normalizeCedula = (val: string) => val?.replace(/[.\-\s]/g, "") || "";
      const normalizedManifiestoCedula = normalizeCedula(manifiesto.cedula);
      const associatedRow = rows.find(r => 
        r.placa?.toUpperCase() === manifiesto.placa?.toUpperCase() && 
        normalizeCedula(r.cedula) === normalizedManifiestoCedula
      );
      
      // Convert municipality codes to names from database (destinos table)
      const origCode = details.CODMUNICIPIOORIGENMANIFIESTO || manifiesto.codMunicipioOrigen || "";
      const destCode = details.CODMUNICIPIODESTINOMANIFIESTO || manifiesto.codMunicipioDestino || "";
      
      // Lookup municipality names from database destinos table
      let origName = origCode;
      let destName = destCode;
      try {
        const municipiosRes = await apiRequest("POST", "/api/destinos/municipios-batch", {
          codes: [origCode, destCode].filter(Boolean)
        });
        const municipiosData = await municipiosRes.json();
        if (municipiosData.success && municipiosData.municipios) {
          origName = municipiosData.municipios[origCode] || getMunicipioName(origCode);
          destName = municipiosData.municipios[destCode] || getMunicipioName(destCode);
        }
      } catch {
        // Fallback to static mapping if database lookup fails
        origName = getMunicipioName(origCode);
        destName = getMunicipioName(destCode);
      }
      const cargoDesc = "ALIMENTO PARA AVES DE CORRAL";
      
      const buildNombreConductor = () => {
        if (conductor) {
          const nombres = [conductor.PRIMERNOMBREIDTERCERO, conductor.SEGUNDONOMBREIDTERCERO].filter(Boolean).join(" ");
          const apellidos = [conductor.PRIMERAPELLIDOIDTERCERO, conductor.SEGUNDOAPELLIDOIDTERCERO].filter(Boolean).join(" ");
          return `${nombres} ${apellidos}`.trim() || conductor.NOMBRERAZONSOCIAL || "";
        }
        return associatedRow?.cedulaData?.nombre || "";
      };
      
      const buildNombreTitular = () => {
        if (titular) {
          if (titular.NOMBRERAZONSOCIAL) return titular.NOMBRERAZONSOCIAL;
          const nombres = [titular.PRIMERNOMBREIDTERCERO, titular.SEGUNDONOMBREIDTERCERO].filter(Boolean).join(" ");
          const apellidos = [titular.PRIMERAPELLIDOIDTERCERO, titular.SEGUNDOAPELLIDOIDTERCERO].filter(Boolean).join(" ");
          return `${nombres} ${apellidos}`.trim();
        }
        return details.NOMIDTITULARMANIFIESTOCARGA || manifiesto.numIdTitular;
      };

      // Build QR data according to official RNDC specification
      // Format valor with comma separator (e.g., 829440 -> "829,440")
      const valorFlete = parseInt(details.VALORFLETEPACTADOVIAJE || String(manifiesto.valorFlete) || "0");
      const valorFormateado = formatValorQR(valorFlete);
      
      const qrResponse = await apiRequest("POST", "/api/rndc/manifiesto-qr", {
        mec: details.INGRESOID,
        fecha: details.FECHAEXPEDICIONMANIFIESTO,
        placa: details.NUMPLACA,
        remolque: details.NUMPLACAREMOLQUE || undefined,
        config: details.NUMPLACAREMOLQUE ? "3S2" : "2",
        orig: origName.substring(0, 20),
        dest: destName.substring(0, 20),
        mercancia: cargoDesc.substring(0, 30),
        conductor: details.NUMIDCONDUCTOR,
        empresa: (settings.companyName || "TRANSPETROMIRA S.A.S").substring(0, 30),
        valor: valorFormateado,
        seguro: details.SEGURIDADQR,
      });

      const qrResult = await qrResponse.json();
      if (!qrResult.success) {
        toast({ title: "Error", description: "No se pudo generar el código QR", variant: "destructive" });
        return;
      }

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
      const pageWidth = 279;
      const pageHeight = 216;

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      // Aggressive compression for minimal PDF size (target ~100KB)
      const compressImageForPdf = (img: HTMLImageElement, maxWidth: number, maxHeight: number, quality: number): string => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return img.src;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        return canvas.toDataURL('image/jpeg', quality);
      };
      
      // Convert QR PNG to compressed JPEG for smaller size
      const compressQrToJpeg = (img: HTMLImageElement, size: number): string => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return img.src;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', 0.85);
      };

      // Fetch saved template
      let pdfTemplate: { fields: any[]; backgroundImage1?: string; backgroundImage2?: string } | null = null;
      try {
        const templateRes = await apiRequest("GET", "/api/pdf-templates/default/manifiesto");
        const templateData = await templateRes.json();
        if (templateData.success && templateData.template) {
          pdfTemplate = templateData.template;
        }
      } catch {
        console.log("No template found, using default positions");
      }

      // Build data dictionary for field mapping
      const titularNombre = buildNombreTitular();
      const titularTelefono = titular?.NUMTELEFONOCONTACTO || "";
      const titularDireccion = titular?.NOMENCLATURADIRECCION || "";
      const titularCiudad = titular?.CODMUNICIPIORNDC || settings.companyCity || "";
      const marcaVehiculo = vehiculoExtra?.MARCA || vehiculo?.CODMARCAVEHICULOCARGA || "";
      const pesoVacio = vehiculo?.PESOVEHICULOVACIO || associatedRow?.placaData?.pesoVacio || "";
      const configVehiculo = vehiculoExtra?.CODCONFIGURACION || (details.NUMPLACAREMOLQUE ? "3S2" : "C2");
      const aseguradoraSoat = vehiculo?.NUMNITASEGURADORASOAT || "";
      const polizaSoat = vehiculo?.NUMSEGUROSOAT || "";
      const venceSoat = vehiculo?.FECHAVENCIMIENTOSOAT || vehiculoExtra?.FECHAVENCE_SOAT || associatedRow?.placaData?.venceSoat || "";
      const conductorNombre = buildNombreConductor();
      const conductorTelefono = conductor?.NUMTELEFONOCONTACTO || "";
      const conductorDireccion = conductor?.NOMENCLATURADIRECCION || "";
      const conductorLicencia = conductor?.NUMLICENCIACONDUCCION || "";
      const tenedorId = vehiculo?.NUMIDTENEDOR || manifiesto.numIdTitular;
      const tenedorTipo = vehiculo?.CODTIPOIDTENEDOR || manifiesto.tipoIdTitular;
      const cantidadKg = associatedRemesa?.cantidadCargada || (associatedRow?.toneladas ? (parseFloat(associatedRow?.toneladas || "0") * 1000).toString() : "");
      const valorTotal = parseInt(details.VALORFLETEPACTADOVIAJE || String(manifiesto.valorFlete) || "0");
      const retencionFuente = Math.round(manifiesto.valorFlete * 0.01);
      const valorNeto = manifiesto.valorFlete - retencionFuente;
      const anticipo = parseInt(details.VALORANTICIPOMANIFIESTO || "0");
      const saldo = valorNeto - anticipo;
      const valorEnLetras = `${Math.floor(manifiesto.valorFlete / 1000)} MIL PESOS M/CTE`;

      const dataDict: Record<string, string> = {
        consecutivo: String(manifiesto.consecutivo),
        ingresoId: details.INGRESOID || "",
        fechaExpedicion: details.FECHAEXPEDICIONMANIFIESTO || "",
        fechaRadicacion: details.FECHAEXPEDICIONMANIFIESTO || "",
        tipoManifiesto: "General",
        origen: origName.substring(0, 25),
        destino: destName.substring(0, 25),
        titularNombre: titularNombre.substring(0, 35),
        titularDocumento: `${manifiesto.tipoIdTitular}: ${manifiesto.numIdTitular}`,
        titularDireccion: titularDireccion.substring(0, 35),
        titularTelefono: titularTelefono,
        titularCiudad: titularCiudad.substring(0, 18),
        placa: details.NUMPLACA || "",
        marca: marcaVehiculo.substring(0, 12),
        placaRemolque: details.NUMPLACAREMOLQUE || "",
        configuracion: configVehiculo,
        pesoVacio: pesoVacio,
        aseguradoraSoat: aseguradoraSoat.substring(0, 18),
        polizaSoat: polizaSoat.substring(0, 12),
        venceSoat: venceSoat,
        conductorNombre: conductorNombre.substring(0, 40),
        conductorDocumento: `CC: ${manifiesto.cedula}`,
        conductorDireccion: conductorDireccion.substring(0, 35),
        conductorTelefono: conductorTelefono,
        conductorLicencia: conductorLicencia,
        cedula: manifiesto.cedula,
        tenedorDocumento: `${tenedorTipo}: ${tenedorId}`,
        tenedorDireccion: titularDireccion.substring(0, 30),
        tenedorTelefono: titularTelefono,
        remesaNumero: String(manifiesto.consecutivoRemesa),
        unidadMedida: "Kilogramos",
        cantidad: cantidadKg,
        naturaleza: "Carga Normal",
        producto: "ALIMENTO PARA AVES DE CORRAL",
        remitente: associatedRow?.granja?.substring(0, 25) || "",
        destinatario: associatedRow?.planta?.substring(0, 25) || "",
        valorTotal: `$${valorTotal.toLocaleString()}`,
        retencionFuente: `$${retencionFuente.toLocaleString()}`,
        retencionIca: `$${parseInt(details.RETENCIONICAMANIFIESTOCARGA || "0").toLocaleString()}`,
        valorNeto: `$${valorNeto.toLocaleString()}`,
        anticipo: `$${anticipo.toLocaleString()}`,
        saldo: `$${saldo.toLocaleString()}`,
        lugarPago: settings.companyCity || "BOGOTA D.C.",
        fechaPago: manifiesto.fechaPagoSaldo || "",
        valorEnLetras: valorEnLetras,
        hrsCargue: "0.00",
        hrsDescargue: "2.00",
        fechaCargue: associatedRemesa?.fechaCargue || "",
        horaCargue: associatedRemesa?.horaCargue || "",
        fechaDescargue: associatedRemesa?.fechaDescargue || "",
        horaDescargue: associatedRemesa?.horaDescargue || "",
      };

      // Load background images (from template if available, otherwise use defaults)
      const bgSrc1 = pdfTemplate?.backgroundImage1 || (pdfTemplate ? null : "/manifiesto_template_p1.jpg");
      const bgSrc2 = pdfTemplate?.backgroundImage2 || (pdfTemplate ? null : "/manifiesto_template_p2.png");
      
      const qrImg = await loadImage(qrResult.qrDataUrl);
      
      let compressedBg1: string | null = null;
      let compressedBg2: string | null = null;
      
      if (bgSrc1) {
        const rawTemplateP1 = await loadImage(bgSrc1);
        compressedBg1 = compressImageForPdf(rawTemplateP1, 720, 555, 0.3);
      }
      if (bgSrc2) {
        const rawTemplateP2 = await loadImage(bgSrc2);
        compressedBg2 = compressImageForPdf(rawTemplateP2, 720, 555, 0.3);
      }

      // Page 1
      if (compressedBg1) {
        pdf.addImage(compressedBg1, "JPEG", 0, 0, pageWidth, pageHeight);
      }
      // QR: 40mm (4cm), top-right corner, 2cm from edges (compressed JPEG)
      const qrSize = 40;
      const qrX = pageWidth - 20 - qrSize;
      const qrY = 20;
      const compressedQr = compressQrToJpeg(qrImg, 400);
      pdf.addImage(compressedQr, "JPEG", qrX, qrY, qrSize, qrSize);

      // Render fields using template or default positions
      const templateFields = pdfTemplate?.fields || [];
      const page1Fields = templateFields.filter((f: any) => f.page === 1);
      const page2Fields = templateFields.filter((f: any) => f.page === 2);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);

      const renderField = (field: any) => {
        const fontSize = field.fontSize || 6;
        pdf.setFontSize(fontSize);
        if (field.fontWeight === "bold") {
          pdf.setFont("helvetica", "bold");
        } else {
          pdf.setFont("helvetica", "normal");
        }
        
        let value = "";
        if (field.isCustom && field.bindingType === "static") {
          value = field.defaultValue || "";
        } else {
          value = dataDict[field.dataKey] || field.defaultValue || "";
        }
        
        pdf.text(value, field.x, field.y);
      };

      if (page1Fields.length > 0) {
        page1Fields.forEach(renderField);
      } else {
        // Fallback to hardcoded positions if no template
        pdf.setFontSize(7);
        pdf.text(dataDict.consecutivo, 238, 29);
        pdf.text(dataDict.ingresoId, 238, 36);
        pdf.setFontSize(6);
        pdf.text(dataDict.fechaExpedicion, 20, 52);
        pdf.text(dataDict.fechaRadicacion, 60, 52);
        pdf.text(dataDict.tipoManifiesto, 107, 52);
        pdf.text(dataDict.origen, 145, 52);
        pdf.text(dataDict.destino, 202, 52);
        pdf.text(dataDict.titularNombre, 20, 66);
        pdf.text(dataDict.titularDocumento, 90, 66);
        pdf.text(dataDict.titularDireccion, 140, 66);
        pdf.text(dataDict.titularTelefono, 202, 66);
        pdf.text(dataDict.titularCiudad, 252, 66);
        pdf.text(dataDict.placa, 20, 77);
        pdf.text(dataDict.marca, 50, 77);
        pdf.text(dataDict.placaRemolque, 82, 77);
        pdf.text(dataDict.configuracion, 130, 77);
        pdf.text(dataDict.pesoVacio, 152, 77);
        pdf.text(dataDict.aseguradoraSoat, 195, 77);
        pdf.text(dataDict.polizaSoat, 237, 77);
        pdf.text(dataDict.venceSoat, 259, 77);
        pdf.text(dataDict.conductorNombre, 20, 87);
        pdf.text(dataDict.conductorDocumento, 80, 87);
        pdf.text(dataDict.conductorDireccion, 130, 87);
        pdf.text(dataDict.conductorTelefono, 195, 87);
        pdf.text(dataDict.conductorLicencia, 225, 87);
        pdf.text(dataDict.tenedorDocumento, 20, 107);
        pdf.text(dataDict.tenedorDireccion, 130, 107);
        pdf.text(dataDict.tenedorTelefono, 205, 107);
        pdf.setFontSize(5);
        pdf.text(dataDict.remesaNumero, 15, 126);
        pdf.text(dataDict.unidadMedida, 37, 126);
        pdf.text(dataDict.cantidad, 57, 126);
        pdf.text(dataDict.naturaleza, 75, 126);
        pdf.text(dataDict.producto, 101, 131);
        pdf.text(dataDict.remitente, 155, 126);
        pdf.text(dataDict.destinatario, 205, 126);
        pdf.setFontSize(6);
        pdf.text(dataDict.valorTotal, 53, 150);
        pdf.text(dataDict.retencionFuente, 53, 157);
        pdf.text(dataDict.retencionIca, 53, 163);
        pdf.text(dataDict.valorNeto, 53, 170);
        pdf.text(dataDict.anticipo, 53, 177);
        pdf.text(dataDict.saldo, 53, 183);
        pdf.text(dataDict.lugarPago, 143, 150);
        pdf.text(dataDict.fechaPago, 170, 150);
        pdf.setFontSize(5);
        pdf.text(dataDict.valorEnLetras, 53, 191);
      }

      // Page 2
      pdf.addPage("letter", "landscape");
      if (compressedBg2) {
        pdf.addImage(compressedBg2, "JPEG", 0, 0, pageWidth, pageHeight);
      }

      if (page2Fields.length > 0) {
        page2Fields.forEach(renderField);
      } else {
        // Fallback to hardcoded positions
        pdf.setFontSize(7);
        pdf.text(dataDict.consecutivo, 238, 45);
        pdf.text(dataDict.ingresoId, 238, 52);
        pdf.setFontSize(6);
        pdf.text(dataDict.placa, 42, 70);
        pdf.text(dataDict.conductorNombre, 110, 70);
        pdf.text(dataDict.cedula, 240, 70);
        pdf.setFontSize(5);
        pdf.text(dataDict.remesaNumero, 17, 90);
        pdf.text(dataDict.hrsCargue, 52, 90);
        pdf.text(dataDict.hrsDescargue, 67, 90);
        pdf.text(dataDict.fechaCargue, 88, 90);
        pdf.text(dataDict.horaCargue, 105, 90);
        pdf.text(dataDict.fechaDescargue, 198, 90);
        pdf.text(dataDict.horaDescargue, 218, 90);
      }

      pdf.save(`${details.NUMPLACA}_${manifiesto.consecutivo}.pdf`);
      toast({ title: "PDF Generado", description: `${details.NUMPLACA}_${manifiesto.consecutivo}.pdf descargado` });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Error al generar el PDF", variant: "destructive" });
    }
  };

  const generateBulkPdfs = async () => {
    if (selectedManifestosForPdf.size === 0) return;
    
    setIsGeneratingBulkPdfs(true);
    const zip = new JSZip();
    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];
    
    toast({ title: "Generando PDFs", description: `Procesando ${selectedManifestosForPdf.size} manifiestos...` });
    
    // Fetch template once for all PDFs
    let pdfTemplate: { fields: any[]; backgroundImage1?: string; backgroundImage2?: string } | null = null;
    try {
      const templateRes = await apiRequest("GET", "/api/pdf-templates/default/manifiesto");
      const templateData = await templateRes.json();
      if (templateData.success && templateData.template) pdfTemplate = templateData.template;
    } catch {}
    
    // Pre-load and compress background images once
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };
    
    const compressImageForPdf = (img: HTMLImageElement, maxWidth: number, maxHeight: number, quality: number): string => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
      if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return img.src;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    };
    
    const compressQrToJpeg = (img: HTMLImageElement, size: number): string => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return img.src;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.85);
    };
    
    const bgSrc1 = pdfTemplate?.backgroundImage1 || (pdfTemplate ? null : "/manifiesto_template_p1.jpg");
    const bgSrc2 = pdfTemplate?.backgroundImage2 || (pdfTemplate ? null : "/manifiesto_template_p2.png");
    
    let compressedBg1: string | null = null;
    let compressedBg2: string | null = null;
    
    if (bgSrc1) {
      try {
        const rawBg1 = await loadImage(bgSrc1);
        compressedBg1 = compressImageForPdf(rawBg1, 720, 555, 0.3);
      } catch {}
    }
    if (bgSrc2) {
      try {
        const rawBg2 = await loadImage(bgSrc2);
        compressedBg2 = compressImageForPdf(rawBg2, 720, 555, 0.3);
      } catch {}
    }
    
    const wsUrl = settings.wsEnvironment === "production" ? settings.wsUrlProd : settings.wsUrlTest;
    const pageWidth = 279;
    const pageHeight = 216;
    
    const selectedIndices = Array.from(selectedManifestosForPdf);
    for (const index of selectedIndices) {
      const manifiesto = generatedManifiestos[index];
      if (!manifiesto || manifiesto.status !== "success") continue;
      
      try {
        const detailsRes = await apiRequest("POST", "/api/rndc/manifiesto-details-enhanced", {
          username: settings.usernameRndc,
          password: settings.passwordRndc,
          companyNit: settings.companyNit,
          numManifiesto: String(manifiesto.consecutivo),
          numPlaca: manifiesto.placa,
          numIdConductor: manifiesto.cedula,
          numIdTitular: manifiesto.numIdTitular,
          wsUrl,
          companyName: settings.companyName || "TRANSPETROMIRA S.A.S",
          companyAddress: settings.companyAddress || "",
          companyPhone: settings.companyPhone || "",
          companyCity: settings.companyCity || "",
        });
        
        const detailsResult = await detailsRes.json();
        if (!detailsResult.success || !detailsResult.details) {
          errorCount++;
          errorMessages.push(`${manifiesto.placa}: No se obtuvieron detalles`);
          continue;
        }
        
        const details = detailsResult.details;
        const conductor = detailsResult.conductor;
        const titular = detailsResult.titular;
        const vehiculo = detailsResult.vehiculo;
        const vehiculoExtra = detailsResult.vehiculoExtra;
        
        const normalizeCedula = (val: string) => val?.replace(/[.\-\s]/g, "") || "";
        const normalizedManifiestoCedula = normalizeCedula(manifiesto.cedula);
        const associatedRow = rows.find(r => 
          r.placa?.toUpperCase() === manifiesto.placa?.toUpperCase() && 
          normalizeCedula(r.cedula) === normalizedManifiestoCedula
        );
        const associatedRemesa = generatedRemesas.find(r => r.consecutivo === manifiesto.consecutivoRemesa);
        
        const origName = manifiesto.codMunicipioOrigen || "";
        const destName = manifiesto.codMunicipioDestino || "";
        const cargoDesc = "ALIMENTO PARA AVES DE CORRAL";
        
        const buildNombreConductor = () => {
          if (conductor) {
            const nombres = [conductor.PRIMERNOMBREIDTERCERO, conductor.SEGUNDONOMBREIDTERCERO].filter(Boolean).join(" ");
            const apellidos = [conductor.PRIMERAPELLIDOIDTERCERO, conductor.SEGUNDOAPELLIDOIDTERCERO].filter(Boolean).join(" ");
            return `${nombres} ${apellidos}`.trim() || conductor.NOMBRERAZONSOCIAL || "";
          }
          return associatedRow?.cedulaData?.nombre || "";
        };
        
        const buildNombreTitular = () => {
          if (titular) {
            if (titular.NOMBRERAZONSOCIAL) return titular.NOMBRERAZONSOCIAL;
            const nombres = [titular.PRIMERNOMBREIDTERCERO, titular.SEGUNDONOMBREIDTERCERO].filter(Boolean).join(" ");
            const apellidos = [titular.PRIMERAPELLIDOIDTERCERO, titular.SEGUNDOAPELLIDOIDTERCERO].filter(Boolean).join(" ");
            return `${nombres} ${apellidos}`.trim();
          }
          return details.NOMIDTITULARMANIFIESTOCARGA || manifiesto.numIdTitular;
        };

        const qrResponse = await apiRequest("POST", "/api/rndc/manifiesto-qr", {
          mec: details.INGRESOID,
          fecha: details.FECHAEXPEDICIONMANIFIESTO,
          placa: details.NUMPLACA,
          remolque: details.NUMPLACAREMOLQUE || undefined,
          config: details.NUMPLACAREMOLQUE ? "3S2" : "2",
          orig: origName.substring(0, 20),
          dest: destName.substring(0, 20),
          mercancia: cargoDesc.substring(0, 30),
          conductor: details.NUMIDCONDUCTOR,
          empresa: (settings.companyName || "TRANSPETROMIRA S.A.S").substring(0, 30),
          obs: details.ACEPTACIONELECTRONICA === "S" ? "ACEPTACION ELECTRONICA" : "",
          seguro: details.SEGURIDADQR,
        });
        
        const qrResult = await qrResponse.json();
        if (!qrResult.success) {
          errorCount++;
          errorMessages.push(`${manifiesto.placa}: Error generando QR`);
          continue;
        }
        
        // Build complete data dictionary matching single PDF generation
        const titularNombre = buildNombreTitular();
        const titularTelefono = titular?.NUMTELEFONOCONTACTO || "";
        const titularDireccion = titular?.NOMENCLATURADIRECCION || "";
        const titularCiudad = titular?.CODMUNICIPIORNDC || settings.companyCity || "";
        const marcaVehiculo = vehiculoExtra?.MARCA || vehiculo?.CODMARCAVEHICULOCARGA || "";
        const pesoVacio = vehiculo?.PESOVEHICULOVACIO || associatedRow?.placaData?.pesoVacio || "";
        const configVehiculo = vehiculoExtra?.CODCONFIGURACION || (details.NUMPLACAREMOLQUE ? "3S2" : "C2");
        const aseguradoraSoat = vehiculo?.NUMNITASEGURADORASOAT || "";
        const polizaSoat = vehiculo?.NUMSEGUROSOAT || "";
        const venceSoat = vehiculo?.FECHAVENCIMIENTOSOAT || vehiculoExtra?.FECHAVENCE_SOAT || associatedRow?.placaData?.venceSoat || "";
        const conductorNombre = buildNombreConductor();
        const conductorTelefono = conductor?.NUMTELEFONOCONTACTO || "";
        const conductorDireccion = conductor?.NOMENCLATURADIRECCION || "";
        const conductorLicencia = conductor?.NUMLICENCIACONDUCCION || "";
        const tenedorId = vehiculo?.NUMIDTENEDOR || manifiesto.numIdTitular;
        const tenedorTipo = vehiculo?.CODTIPOIDTENEDOR || manifiesto.tipoIdTitular;
        const cantidadKg = associatedRemesa?.cantidadCargada || (associatedRow?.toneladas ? (parseFloat(associatedRow?.toneladas || "0") * 1000).toString() : "");
        const valorTotal = parseInt(details.VALORFLETEPACTADOVIAJE || String(manifiesto.valorFlete) || "0");
        const retencionFuente = Math.round(manifiesto.valorFlete * 0.01);
        const valorNeto = manifiesto.valorFlete - retencionFuente;
        const anticipo = parseInt(details.VALORANTICIPOMANIFIESTO || "0");
        const saldo = valorNeto - anticipo;
        const valorEnLetras = `${Math.floor(manifiesto.valorFlete / 1000)} MIL PESOS M/CTE`;
        
        const dataDict: Record<string, string> = {
          consecutivo: String(manifiesto.consecutivo),
          ingresoId: details.INGRESOID || "",
          fechaExpedicion: details.FECHAEXPEDICIONMANIFIESTO || "",
          fechaRadicacion: details.FECHAEXPEDICIONMANIFIESTO || "",
          tipoManifiesto: "General",
          origen: origName.substring(0, 25),
          destino: destName.substring(0, 25),
          titularNombre: titularNombre.substring(0, 35),
          titularDocumento: `${manifiesto.tipoIdTitular}: ${manifiesto.numIdTitular}`,
          titularDireccion: titularDireccion.substring(0, 35),
          titularTelefono: titularTelefono,
          titularCiudad: titularCiudad.substring(0, 18),
          placa: details.NUMPLACA || "",
          marca: marcaVehiculo.substring(0, 12),
          placaRemolque: details.NUMPLACAREMOLQUE || "",
          configuracion: configVehiculo,
          pesoVacio: pesoVacio,
          aseguradoraSoat: aseguradoraSoat.substring(0, 18),
          polizaSoat: polizaSoat.substring(0, 12),
          venceSoat: venceSoat,
          conductorNombre: conductorNombre.substring(0, 40),
          conductorDocumento: `CC: ${manifiesto.cedula}`,
          conductorDireccion: conductorDireccion.substring(0, 35),
          conductorTelefono: conductorTelefono,
          conductorLicencia: conductorLicencia,
          cedula: manifiesto.cedula,
          tenedorDocumento: `${tenedorTipo}: ${tenedorId}`,
          tenedorDireccion: titularDireccion.substring(0, 30),
          tenedorTelefono: titularTelefono,
          remesaNumero: String(manifiesto.consecutivoRemesa),
          unidadMedida: "Kilogramos",
          cantidad: cantidadKg,
          naturaleza: "Carga Normal",
          producto: "ALIMENTO PARA AVES DE CORRAL",
          remitente: associatedRow?.granja?.substring(0, 25) || "",
          destinatario: associatedRow?.planta?.substring(0, 25) || "",
          valorTotal: `$${valorTotal.toLocaleString()}`,
          retencionFuente: `$${retencionFuente.toLocaleString()}`,
          retencionIca: `$${parseInt(details.RETENCIONICAMANIFIESTOCARGA || "0").toLocaleString()}`,
          valorNeto: `$${valorNeto.toLocaleString()}`,
          anticipo: `$${anticipo.toLocaleString()}`,
          saldo: `$${saldo.toLocaleString()}`,
          lugarPago: settings.companyCity || "BOGOTA D.C.",
          fechaPago: manifiesto.fechaPagoSaldo || "",
          valorEnLetras: valorEnLetras,
          hrsCargue: "0.00",
          hrsDescargue: "2.00",
          fechaCargue: associatedRemesa?.fechaCargue || "",
          horaCargue: associatedRemesa?.horaCargue || "",
          fechaDescargue: associatedRemesa?.fechaDescargue || "",
          horaDescargue: associatedRemesa?.horaDescargue || "",
        };
        
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
        const qrImg = await loadImage(qrResult.qrDataUrl);
        
        // Page 1
        if (compressedBg1) pdf.addImage(compressedBg1, "JPEG", 0, 0, pageWidth, pageHeight);
        // QR: 40mm (4cm), top-right corner, 2cm from edges (compressed JPEG)
        const qrSize = 40;
        const qrX = pageWidth - 20 - qrSize;
        const qrY = 20;
        const compressedQr = compressQrToJpeg(qrImg, 400);
        pdf.addImage(compressedQr, "JPEG", qrX, qrY, qrSize, qrSize);
        
        const templateFields = pdfTemplate?.fields || [];
        const page1Fields = templateFields.filter((f: any) => f.page === 1);
        const page2Fields = templateFields.filter((f: any) => f.page === 2);
        
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        
        const renderField = (field: any) => {
          const fontSize = field.fontSize || 6;
          pdf.setFontSize(fontSize);
          pdf.setFont("helvetica", field.fontWeight === "bold" ? "bold" : "normal");
          const value = field.isCustom && field.bindingType === "static" ? (field.defaultValue || "") : (dataDict[field.dataKey] || field.defaultValue || "");
          pdf.text(value, field.x, field.y);
        };
        
        if (page1Fields.length > 0) {
          page1Fields.forEach(renderField);
        } else {
          // Fallback to hardcoded positions matching single PDF
          pdf.setFontSize(7);
          pdf.text(dataDict.consecutivo, 238, 29);
          pdf.text(dataDict.ingresoId, 238, 36);
          pdf.setFontSize(6);
          pdf.text(dataDict.fechaExpedicion, 20, 52);
          pdf.text(dataDict.fechaRadicacion, 60, 52);
          pdf.text(dataDict.tipoManifiesto, 107, 52);
          pdf.text(dataDict.origen, 145, 52);
          pdf.text(dataDict.destino, 202, 52);
          pdf.text(dataDict.titularNombre, 20, 66);
          pdf.text(dataDict.titularDocumento, 90, 66);
          pdf.text(dataDict.titularDireccion, 140, 66);
          pdf.text(dataDict.titularTelefono, 202, 66);
          pdf.text(dataDict.titularCiudad, 252, 66);
          pdf.text(dataDict.placa, 20, 77);
          pdf.text(dataDict.marca, 50, 77);
          pdf.text(dataDict.placaRemolque, 82, 77);
          pdf.text(dataDict.configuracion, 130, 77);
          pdf.text(dataDict.pesoVacio, 152, 77);
          pdf.text(dataDict.aseguradoraSoat, 195, 77);
          pdf.text(dataDict.polizaSoat, 237, 77);
          pdf.text(dataDict.venceSoat, 259, 77);
          pdf.text(dataDict.conductorNombre, 20, 87);
          pdf.text(dataDict.conductorDocumento, 80, 87);
          pdf.text(dataDict.conductorDireccion, 130, 87);
          pdf.text(dataDict.conductorTelefono, 195, 87);
          pdf.text(dataDict.conductorLicencia, 225, 87);
          pdf.text(dataDict.tenedorDocumento, 20, 107);
          pdf.text(dataDict.tenedorDireccion, 130, 107);
          pdf.text(dataDict.tenedorTelefono, 205, 107);
          pdf.setFontSize(5);
          pdf.text(dataDict.remesaNumero, 15, 126);
          pdf.text(dataDict.unidadMedida, 37, 126);
          pdf.text(dataDict.cantidad, 57, 126);
          pdf.text(dataDict.naturaleza, 75, 126);
          pdf.text(dataDict.producto, 101, 131);
          pdf.text(dataDict.remitente, 155, 126);
          pdf.text(dataDict.destinatario, 205, 126);
          pdf.setFontSize(6);
          pdf.text(dataDict.valorTotal, 53, 150);
          pdf.text(dataDict.retencionFuente, 53, 157);
          pdf.text(dataDict.retencionIca, 53, 163);
          pdf.text(dataDict.valorNeto, 53, 170);
          pdf.text(dataDict.anticipo, 53, 177);
          pdf.text(dataDict.saldo, 53, 183);
          pdf.text(dataDict.lugarPago, 143, 150);
          pdf.text(dataDict.fechaPago, 170, 150);
          pdf.setFontSize(5);
          pdf.text(dataDict.valorEnLetras, 53, 191);
        }
        
        // Page 2
        pdf.addPage("letter", "landscape");
        if (compressedBg2) pdf.addImage(compressedBg2, "JPEG", 0, 0, pageWidth, pageHeight);
        
        if (page2Fields.length > 0) {
          page2Fields.forEach(renderField);
        } else {
          pdf.setFontSize(7);
          pdf.text(dataDict.consecutivo, 238, 45);
          pdf.text(dataDict.ingresoId, 238, 52);
          pdf.setFontSize(6);
          pdf.text(dataDict.placa, 42, 70);
          pdf.text(dataDict.conductorNombre, 110, 70);
          pdf.text(dataDict.cedula, 240, 70);
          pdf.setFontSize(5);
          pdf.text(dataDict.remesaNumero, 17, 90);
          pdf.text(dataDict.hrsCargue, 52, 90);
          pdf.text(dataDict.hrsDescargue, 67, 90);
          pdf.text(dataDict.fechaCargue, 88, 90);
          pdf.text(dataDict.horaCargue, 105, 90);
          pdf.text(dataDict.fechaDescargue, 198, 90);
          pdf.text(dataDict.horaDescargue, 218, 90);
        }
        
        const pdfBlob = pdf.output('blob');
        const fileName = `${details.NUMPLACA}_${manifiesto.consecutivo}.pdf`;
        zip.file(fileName, pdfBlob);
        successCount++;
        
      } catch (error) {
        console.error(`Error generating PDF for manifest ${manifiesto.consecutivo}:`, error);
        errorCount++;
        errorMessages.push(`${manifiesto.placa}: Error inesperado`);
      }
    }
    
    if (successCount > 0) {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Manifiestos_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ title: "PDFs Generados", description: `${successCount} PDFs descargados en ZIP${errorCount > 0 ? `, ${errorCount} errores` : ''}` });
    } else {
      toast({ title: "Error", description: `No se pudo generar ningún PDF. ${errorMessages.slice(0, 3).join(', ')}`, variant: "destructive" });
    }
    
    setSelectedManifestosForPdf(new Set());
    setIsGeneratingBulkPdfs(false);
  };

  const toggleManifestoSelection = (index: number) => {
    setSelectedManifestosForPdf(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const selectAllManifestosForPdf = () => {
    const successIndices = generatedManifiestos
      .map((m, i) => (m.status === "success" ? i : -1))
      .filter(i => i !== -1);
    setSelectedManifestosForPdf(new Set(successIndices));
  };

  const getRemesaStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-500">Exitoso</Badge>;
      case "error": return <Badge variant="destructive">Error</Badge>;
      case "processing": return <Badge className="bg-yellow-500">Procesando</Badge>;
      default: return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  const handleSendRemesas = async () => {
    if (generatedRemesas.length === 0) return;

    setIsSendingRemesas(true);

    try {
      const wsUrl = settings.wsEnvironment === "production" 
        ? settings.wsUrlProd 
        : settings.wsUrlTest;

      const submissions = generatedRemesas.map(r => ({
        consecutivoRemesa: String(r.consecutivo),
        numNitEmpresa: settings.companyNit,
        numPlaca: r.placa,
        cantidadCargada: r.cantidadCargada,
        fechaCargue: r.fechaCargue,
        horaCargue: r.horaCargue,
        fechaDescargue: r.fechaDescargue,
        horaDescargue: r.horaDescargue,
        sedeRemitente: r.sedeRemitente || "",
        sedeDestinatario: r.sedeDestinatario || "",
        codMunicipioOrigen: r.codMunicipioOrigen || "",
        codMunicipioDestino: r.codMunicipioDestino || "",
        tipoIdPropietario: r.tipoIdPropietario || "",
        numIdPropietario: r.numIdPropietario || "",
        cedula: r.cedula || "",
        valorFlete: r.valorFlete || 0,
        xmlRequest: r.xmlRequest,
      }));

      const response = await apiRequest("POST", "/api/rndc/remesa-batch", {
        submissions,
        wsUrl,
      });

      const result = await response.json();

      if (result.success) {
        setCurrentBatchId(result.batchId);
        toast({ title: "Enviando", description: result.message });
        
        // Start polling for results
        pollRemesaResults(result.batchId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSendingRemesas(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Error al enviar remesas", variant: "destructive" });
      setIsSendingRemesas(false);
    }
  };

  const pollRemesaResults = async (batchId: string) => {
    const poll = async () => {
      try {
        const response = await apiRequest("GET", `/api/rndc/remesa/${batchId}`);
        const result = await response.json();

        if (result.success) {
          const updatedRemesas = generatedRemesas.map(r => {
            const serverResult = result.submissions.find(
              (s: any) => s.consecutivoRemesa === String(r.consecutivo)
            );
            if (serverResult) {
              return {
                ...r,
                status: serverResult.status as "pending" | "processing" | "success" | "error",
                responseCode: serverResult.responseCode,
                responseMessage: serverResult.responseMessage,
                idRemesa: serverResult.idRemesa,
              };
            }
            return r;
          });

          setGeneratedRemesas(updatedRemesas);

          const allProcessed = result.submissions.every(
            (s: any) => s.status === "success" || s.status === "error"
          );

          if (allProcessed) {
            setIsSendingRemesas(false);
            const successCount = result.submissions.filter((s: any) => s.status === "success").length;
            const errorCount = result.submissions.filter((s: any) => s.status === "error").length;
            toast({
              title: "Proceso completado",
              description: `${successCount} exitosos, ${errorCount} errores`,
            });
          } else {
            setTimeout(poll, 2000);
          }
        }
      } catch (error) {
        setIsSendingRemesas(false);
        toast({ title: "Error", description: "Error al obtener resultados", variant: "destructive" });
      }
    };

    poll();
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Cargar Excel de Despachos
              </CardTitle>
              <Button 
                variant="outline" 
                onClick={() => setShowSavedDespachos(!showSavedDespachos)}
                data-testid="button-show-saved-header"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {showSavedDespachos ? "Ocultar Guardados" : "Cargar Guardados"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSavedDespachos && savedDespachos.length > 0 && (
                <Card className="border-dashed mb-4">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Despachos Guardados ({filteredDespachos.length} de {savedDespachos.length})</CardTitle>
                    </div>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, fecha o estado..."
                        value={despachoSearch}
                        onChange={(e) => { setDespachoSearch(e.target.value); setDespachoPage(1); }}
                        className="pl-8 h-9"
                        data-testid="input-search-despachos"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-64 overflow-y-auto">
                      {paginatedDespachos.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/50">
                          <div className="flex-1">
                            <span className="font-medium text-sm">{d.nombre}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({d.totalRows} filas, {d.validRows} OK)
                            </span>
                            {d.status === "completed" && (
                              <Badge className="ml-2 bg-green-600">Completo</Badge>
                            )}
                            {d.status === "remesas_sent" && (
                              <Badge className="ml-2 bg-blue-600">Remesas</Badge>
                            )}
                            {d.status === "draft" && (
                              <Badge variant="outline" className="ml-2">Borrador</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => loadDespacho(d.id)}
                              data-testid={`button-load-header-${d.id}`}
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteDespachoMutation.mutate(d.id)}
                              data-testid={`button-delete-header-${d.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filteredDespachos.length === 0 && despachoSearch && (
                        <div className="text-center text-muted-foreground py-4">
                          No se encontraron despachos para "{despachoSearch}"
                        </div>
                      )}
                    </div>
                    {totalDespachoPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                        <span className="text-xs text-muted-foreground">
                          Página {despachoPage} de {totalDespachoPages}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDespachoPage(p => Math.max(1, p - 1))}
                            disabled={despachoPage === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDespachoPage(p => Math.min(totalDespachoPages, p + 1))}
                            disabled={despachoPage === totalDespachoPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {showSavedDespachos && savedDespachos.length === 0 && (
                <div className="text-center text-muted-foreground py-4 border border-dashed rounded-lg mb-4">
                  No hay despachos guardados
                </div>
              )}
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
                  <Button 
                    variant="default" 
                    onClick={generateRemesasXml}
                    disabled={selectedRows.size === 0}
                    data-testid="button-generate-remesas"
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    Generar Remesas XML ({selectedRows.size})
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
                      variant={generatedManifiestos.length > 0 ? "default" : "outline"}
                      className={generatedManifiestos.length > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => saveDespachoMutation.mutate()}
                      disabled={saveDespachoMutation.isPending}
                      data-testid="button-save-despacho"
                    >
                      {saveDespachoMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                      ) : (
                        <><Save className="mr-2 h-4 w-4" />
                        {generatedManifiestos.length > 0 
                          ? "Guardar Despacho Completo" 
                          : generatedRemesas.length > 0 
                            ? "Guardar con Remesas" 
                            : "Guardar"}
                        </>
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Despachos Guardados ({filteredDespachos.length} de {savedDespachos.length})</CardTitle>
                    </div>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, fecha o estado..."
                        value={despachoSearch}
                        onChange={(e) => { setDespachoSearch(e.target.value); setDespachoPage(1); }}
                        className="pl-8 h-9"
                        data-testid="input-search-despachos-2"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-64 overflow-y-auto">
                      {paginatedDespachos.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/50">
                          <div className="flex-1">
                            <span className="font-medium text-sm">{d.nombre}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({d.totalRows} filas, {d.validRows} OK)
                            </span>
                            {d.status === "completed" && (
                              <Badge className="ml-2 bg-green-600">Completo</Badge>
                            )}
                            {d.status === "remesas_sent" && (
                              <Badge className="ml-2 bg-blue-600">Remesas</Badge>
                            )}
                            {d.status === "draft" && (
                              <Badge variant="outline" className="ml-2">Borrador</Badge>
                            )}
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
                      {filteredDespachos.length === 0 && despachoSearch && (
                        <div className="text-center text-muted-foreground py-4">
                          No se encontraron despachos para "{despachoSearch}"
                        </div>
                      )}
                    </div>
                    {totalDespachoPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                        <span className="text-xs text-muted-foreground">
                          Página {despachoPage} de {totalDespachoPages}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDespachoPage(p => Math.max(1, p - 1))}
                            disabled={despachoPage === 1}
                            data-testid="button-prev-page-2"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDespachoPage(p => Math.min(totalDespachoPages, p + 1))}
                            disabled={despachoPage === totalDespachoPages}
                            data-testid="button-next-page-2"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
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
                        <th className="text-left p-3 font-medium">Mun. Destino</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Planta</th>
                        <th className="text-left p-3 font-medium">Sede</th>
                        <th className="text-left p-3 font-medium">Mun. Origen</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Placa</th>
                        <th className="text-left p-3 font-medium">Tipo ID</th>
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
                            {row.granjaData?.codMunicipio || "-"}
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
                            {row.plantaData?.codMunicipio || "-"}
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
                          <td className="p-3 text-xs">{row.placaData?.tipoIdPropietario || "-"}</td>
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

          {generatedRemesas.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="h-5 w-5" /> XMLs Generados ({generatedRemesas.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Remesas listas para enviar al RNDC</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadRemesas}
                    data-testid="button-download-remesas"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar XML
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleSendRemesas}
                    disabled={isSendingRemesas}
                    data-testid="button-send-remesas"
                  >
                    {isSendingRemesas ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                    ) : (
                      <>Enviar al RNDC <CheckCircle className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearGeneratedRemesas}
                    data-testid="button-clear-remesas"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consecutivo</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Cantidad Cargada</TableHead>
                        <TableHead>Fecha Cargue</TableHead>
                        <TableHead>Fecha Descargue</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>ID Remesa</TableHead>
                        <TableHead>Respuesta</TableHead>
                        <TableHead>XML</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedRemesas.map((remesa, i) => (
                        <TableRow key={i} data-testid={`row-remesa-${i}`}>
                          <TableCell className="font-mono">{remesa.consecutivo}</TableCell>
                          <TableCell>{remesa.placa}</TableCell>
                          <TableCell className="font-mono">{remesa.cantidadCargada}</TableCell>
                          <TableCell>{remesa.fechaCargue} {remesa.horaCargue}</TableCell>
                          <TableCell>{remesa.fechaDescargue} {remesa.horaDescargue}</TableCell>
                          <TableCell>{getRemesaStatusBadge(remesa.status)}</TableCell>
                          <TableCell className="font-mono">{remesa.idRemesa || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs" title={remesa.responseMessage}>
                            {remesa.responseMessage || "-"}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-view-xml-${i}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>XML Remesa - Consecutivo {remesa.consecutivo}</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh]">
                                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                    {remesa.xmlRequest}
                                  </pre>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {(generatedRemesas.filter(r => r.status === "success").length > 0 || generatedManifiestos.length > 0) && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-blue-600" /> Paso D: Manifiestos
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {generatedManifiestos.length === 0
                      ? `${generatedRemesas.filter(r => r.status === "success").length} remesas exitosas disponibles para generar manifiestos`
                      : `${generatedManifiestos.length} manifiestos generados`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {generatedManifiestos.length === 0 ? (
                    <Button
                      onClick={generateManifiestosXml}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-generate-manifiestos"
                    >
                      <FileCode className="h-4 w-4 mr-2" />
                      Generar Manifiestos
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadManifiestos}
                        data-testid="button-download-manifiestos"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar XML
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSendManifiestos}
                        disabled={isSendingManifiestos}
                        data-testid="button-send-manifiestos"
                      >
                        {isSendingManifiestos ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando {manifestoProgress.processed}/{manifestoProgress.total}...</>
                        ) : (
                          <>Enviar al RNDC <CheckCircle className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                      {isSendingManifiestos && manifestoProgress.total > 0 && (
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-muted rounded-md text-sm">
                          <span className="text-green-600 font-medium" data-testid="progress-success">
                            <CheckCircle className="h-4 w-4 inline mr-1" />{manifestoProgress.success} OK
                          </span>
                          <span className="text-red-600 font-medium" data-testid="progress-error">
                            <AlertCircle className="h-4 w-4 inline mr-1" />{manifestoProgress.error} Error
                          </span>
                          <span className="text-muted-foreground">
                            {manifestoProgress.total - manifestoProgress.processed} pendientes
                          </span>
                        </div>
                      )}
                      {generatedManifiestos.some(m => m.status === "success") && (
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => saveDespachoMutation.mutate()}
                          disabled={saveDespachoMutation.isPending}
                          data-testid="button-save-despacho-manifiestos"
                        >
                          {saveDespachoMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                          ) : (
                            <><Save className="mr-2 h-4 w-4" /> Guardar Despacho Completo</>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              {generatedManifiestos.length > 0 && (
                <CardContent>
                  <div className="max-h-[300px] overflow-auto rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedManifestosForPdf.size === generatedManifiestos.filter(m => m.status === "success").length) {
                            setSelectedManifestosForPdf(new Set());
                          } else {
                            selectAllManifestosForPdf();
                          }
                        }}
                        data-testid="button-select-all-manifiestos"
                      >
                        {selectedManifestosForPdf.size === generatedManifiestos.filter(m => m.status === "success").length ? (
                          <><CheckSquare className="h-4 w-4 mr-1" /> Deseleccionar</>
                        ) : (
                          <><Square className="h-4 w-4 mr-1" /> Seleccionar Todos</>
                        )}
                      </Button>
                      {selectedManifestosForPdf.size > 0 && (
                        <Button
                          className="bg-purple-600 hover:bg-purple-700"
                          size="sm"
                          onClick={generateBulkPdfs}
                          disabled={isGeneratingBulkPdfs}
                          data-testid="button-generate-bulk-pdfs"
                        >
                          {isGeneratingBulkPdfs ? (
                            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generando...</>
                          ) : (
                            <><Download className="h-4 w-4 mr-1" /> Descargar {selectedManifestosForPdf.size} PDFs (ZIP)</>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportManifiestosExcel}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        data-testid="button-export-manifiestos-excel"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
                      </Button>
                      {failedManifiestosCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={retryAllFailedManifiestos}
                          disabled={isRetryingAllFailed}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          data-testid="button-retry-all-failed"
                        >
                          {isRetryingAllFailed ? (
                            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Reintentando...</>
                          ) : (
                            <><RotateCcw className="h-4 w-4 mr-1" /> Reintentar Fallidos ({failedManifiestosCount})</>
                          )}
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Consecutivo</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Mun. Origen</TableHead>
                          <TableHead>Mun. Destino</TableHead>
                          <TableHead>Cédula Conductor</TableHead>
                          <TableHead>Valor Flete</TableHead>
                          <TableHead>Fecha Pago</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>ID Manifiesto</TableHead>
                          <TableHead>Respuesta</TableHead>
                          <TableHead>XML</TableHead>
                          <TableHead>PDF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedManifiestos.map((manifiesto, i) => (
                          <TableRow key={i} data-testid={`row-manifiesto-${i}`}>
                            <TableCell>
                              {manifiesto.status === "success" && (
                                <button
                                  onClick={() => toggleManifestoSelection(i)}
                                  className="p-1"
                                  data-testid={`checkbox-manifiesto-${i}`}
                                >
                                  {selectedManifestosForPdf.has(i) ? (
                                    <CheckSquare className="h-4 w-4 text-purple-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{manifiesto.consecutivo}</TableCell>
                            <TableCell>{manifiesto.placa}</TableCell>
                            <TableCell className="font-mono text-xs">{manifiesto.codMunicipioOrigen}</TableCell>
                            <TableCell className="font-mono text-xs">{manifiesto.codMunicipioDestino}</TableCell>
                            <TableCell className="font-mono">{manifiesto.cedula}</TableCell>
                            <TableCell className="font-mono text-green-700">${manifiesto.valorFlete.toLocaleString()}</TableCell>
                            <TableCell>{manifiesto.fechaPagoSaldo}</TableCell>
                            <TableCell>{getRemesaStatusBadge(manifiesto.status)}</TableCell>
                            <TableCell className="font-mono">{manifiesto.idManifiesto || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs" title={manifiesto.responseMessage}>
                              {manifiesto.responseMessage || "-"}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-view-manifiesto-xml-${i}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                  <DialogHeader>
                                    <DialogTitle>XML Manifiesto - Consecutivo {manifiesto.consecutivo}</DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="h-[60vh]">
                                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                      {manifiesto.xmlRequest}
                                    </pre>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {manifiesto.status === "success" && (
                                  manifiesto.idManifiesto || 
                                  manifiesto.responseMessage?.match(/IngresoID:\s*(\d+)/i) ||
                                  (manifiesto.responseCode && /^\d+$/.test(manifiesto.responseCode))
                                ) && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => generateManifiestoPdf(manifiesto)}
                                    data-testid={`button-generate-pdf-${i}`}
                                    title="Generar PDF con QR"
                                  >
                                    <FileText className="h-4 w-4 text-blue-600" />
                                  </Button>
                                )}
                                {(manifiesto.status === "error" || manifiesto.status === "pending") && rows.length > 0 && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => regenerateManifiestoXml(i)}
                                    disabled={retryingManifiestoIndex === i || isRetryingAllFailed}
                                    data-testid={`button-regenerate-xml-${i}`}
                                    title="Regenerar XML desde Excel actualizado"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <RefreshCcw className="h-4 w-4" />
                                  </Button>
                                )}
                                {manifiesto.status === "error" && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => retrySingleManifiesto(i)}
                                    disabled={retryingManifiestoIndex === i || isRetryingAllFailed}
                                    data-testid={`button-retry-manifiesto-${i}`}
                                    title="Reintentar envío"
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  >
                                    {retryingManifiestoIndex === i ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                {manifiesto.status === "error" && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => {
                                      setManualUpdateDialog({ open: true, index: i, consecutivo: manifiesto.consecutivo });
                                      setManualUpdateXml("");
                                    }}
                                    data-testid={`button-manual-update-${i}`}
                                    title="Actualizar manualmente con XML de consultas"
                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {manifiesto.status === "processing" && (
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" /> Historial de Remesas
                </CardTitle>
                <p className="text-sm text-muted-foreground">Transacciones enviadas al RNDC - Seleccione para generar manifiestos</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={showRemesasHistory ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowRemesasHistory(!showRemesasHistory);
                    if (!showRemesasHistory) refetchRemesasHistory();
                  }}
                  data-testid="button-toggle-history"
                >
                  {showRemesasHistory ? "Ocultar" : "Ver Historial"}
                </Button>
                {showRemesasHistory && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchRemesasHistory()}
                      data-testid="button-refresh-history"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllSuccessfulHistory}
                      data-testid="button-select-all-success-history"
                    >
                      Seleccionar Exitosas
                    </Button>
                    {selectedHistoryRemesas.size > 0 && (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        size="sm"
                        onClick={generateManifiestosFromHistory}
                        data-testid="button-generate-manifiestos-from-history"
                      >
                        <FileCode className="h-4 w-4 mr-2" />
                        Generar Manifiestos ({selectedHistoryRemesas.size})
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            {showRemesasHistory && (
              <CardContent>
                {remesasHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay remesas enviadas aún</p>
                ) : (
                  <div className="max-h-[400px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Consecutivo</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Fecha Cargue</TableHead>
                          <TableHead>Fecha Descargue</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Manifiesto</TableHead>
                          <TableHead>ID Remesa</TableHead>
                          <TableHead>Respuesta</TableHead>
                          <TableHead>XML</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {remesasHistory.map((remesa: any, i: number) => (
                          <TableRow 
                            key={remesa.id || i} 
                            data-testid={`row-history-${i}`}
                            className={selectedHistoryRemesas.has(remesa.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedHistoryRemesas.has(remesa.id)}
                                onChange={() => toggleHistoryRemesaSelection(remesa.id)}
                                disabled={remesa.status !== "success"}
                                className="h-4 w-4"
                                data-testid={`checkbox-history-${i}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              {remesa.createdAt ? new Date(remesa.createdAt).toLocaleString("es-CO") : "-"}
                            </TableCell>
                            <TableCell className="font-mono">{remesa.consecutivoRemesa}</TableCell>
                            <TableCell>{remesa.numPlaca}</TableCell>
                            <TableCell className="font-mono">{remesa.cantidadCargada}</TableCell>
                            <TableCell>{remesa.fechaCargue} {remesa.horaCargue}</TableCell>
                            <TableCell>{remesa.fechaDescargue} {remesa.horaDescargue}</TableCell>
                            <TableCell>{getRemesaStatusBadge(remesa.status)}</TableCell>
                            <TableCell>
                              {remesa.manifiesto ? (
                                remesa.manifiesto.status === "success" ? (
                                  <Badge className="bg-green-600">
                                    M-{remesa.manifiesto.responseCode}
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">Error</Badge>
                                )
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{remesa.idRemesa || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs" title={remesa.responseMessage}>
                              {remesa.responseMessage || "-"}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-view-history-xml-${i}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                  <DialogHeader>
                                    <DialogTitle>XML Remesa - {remesa.consecutivoRemesa}</DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="h-[60vh]">
                                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                      {remesa.xmlRequest}
                                    </pre>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </main>

      <Dialog open={manualUpdateDialog.open} onOpenChange={(open) => setManualUpdateDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Actualizar Manifiesto {manualUpdateDialog.consecutivo} Manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pegue el XML de respuesta obtenido del módulo de consultas del RNDC. 
              El sistema extraerá automáticamente el ID del manifiesto y marcará el envío como exitoso.
            </p>
            <textarea
              className="w-full h-40 p-3 font-mono text-xs border rounded-lg bg-muted"
              placeholder={`Ejemplo:\n<?xml version="1.0" encoding="ISO-8859-1" ?>\n<root>\n  <ingresoid>113114521</ingresoid>\n  <seguridadqr>2XCSrcFDNcmaCQzEW57Fu5jsubY=</seguridadqr>\n</root>`}
              value={manualUpdateXml}
              onChange={(e) => setManualUpdateXml(e.target.value)}
              data-testid="textarea-manual-xml"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setManualUpdateDialog({ open: false, index: null, consecutivo: null });
                  setManualUpdateXml("");
                }}
                data-testid="button-cancel-manual-update"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleManualUpdateManifiesto}
                disabled={!manualUpdateXml.trim()}
                data-testid="button-confirm-manual-update"
              >
                Actualizar Manifiesto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
