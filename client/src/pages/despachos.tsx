import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, Database, Car, User, RefreshCw, Save, FolderOpen, Trash2, ArrowUpDown, CheckSquare, Square, FileCode, Eye, History, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [showRemesasHistory, setShowRemesasHistory] = useState(false);
  const [stepDComplete, setStepDComplete] = useState(false);
  const [selectedHistoryRemesas, setSelectedHistoryRemesas] = useState<Set<string>>(new Set());

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

    const manifiestos: GeneratedManifiesto[] = [];

    for (const remesa of successRemesas) {
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

      manifiestos.push({
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

    setGeneratedManifiestos(manifiestos);
    toast({
      title: "Manifiestos Generados",
      description: `${manifiestos.length} manifiestos listos para enviar`
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

      if (result.completed) {
        const updatedManifiestos = generatedManifiestos.map(m => {
          const submissionResult = result.results?.find((r: any) => String(r.consecutivoManifiesto) === String(m.consecutivo));
          if (submissionResult) {
            // Extract idManifiesto from response message if not provided directly
            let extractedId = submissionResult.idManifiesto;
            if (!extractedId && submissionResult.responseMessage) {
              const idMatch = submissionResult.responseMessage.match(/IngresoID:\s*(\d+)/i);
              if (idMatch) {
                extractedId = idMatch[1];
              }
            }
            // Also try responseCode for numeric IDs
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
        });
        setGeneratedManifiestos(updatedManifiestos);
        setIsSendingManifiestos(false);
        setStepDComplete(true);

        const successCount = updatedManifiestos.filter(m => m.status === "success").length;
        toast({
          title: "Manifiestos Procesados",
          description: `${successCount}/${updatedManifiestos.length} manifiestos enviados exitosamente`
        });
      } else {
        setTimeout(() => pollManifiestoResults(batchId), 2000);
      }
    } catch {
      setIsSendingManifiestos(false);
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

      const detailsResponse = await apiRequest("POST", "/api/rndc/manifiesto-details", {
        username: settings.usernameRndc,
        password: settings.passwordRndc,
        companyNit: settings.companyNit,
        numManifiesto: String(manifiesto.consecutivo),
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
      const associatedRemesa = generatedRemesas.find(r => r.consecutivo === manifiesto.consecutivoRemesa);
      
      const normalizeCedula = (val: string) => val?.replace(/[.\-\s]/g, "") || "";
      const normalizedManifiestoCedula = normalizeCedula(manifiesto.cedula);
      const associatedRow = rows.find(r => 
        r.placa?.toUpperCase() === manifiesto.placa?.toUpperCase() && 
        normalizeCedula(r.cedula) === normalizedManifiestoCedula
      );
      
      const origName = manifiesto.codMunicipioOrigen || "";
      const destName = manifiesto.codMunicipioDestino || "";
      const cargoDesc = "ALIMENTO PARA AVES DE CORRAL";

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
        toast({ title: "Error", description: "No se pudo generar el código QR", variant: "destructive" });
        return;
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageWidth = 216;
      const pageHeight = 279;
      const margin = 10;
      const leftCol = 12;
      const midCol = pageWidth / 2;
      const rightCol = 160;
      let y = 10;

      const drawLine = (yPos: number) => {
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
      };

      const drawSectionHeader = (text: string, yPos: number) => {
        pdf.setFillColor(220, 220, 220);
        pdf.rect(margin, yPos - 3, pageWidth - margin * 2, 5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text(text, midCol, yPos, { align: "center" });
        return yPos + 4;
      };

      const labelValue = (label: string, value: string, x: number, yPos: number, labelWidth = 25) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6);
        pdf.text(label, x, yPos);
        pdf.setFont("helvetica", "normal");
        pdf.text(value || "-", x + labelWidth, yPos);
      };

      pdf.setFontSize(6);
      pdf.setFont("helvetica", "italic");
      const disclaimer = "La impresion en soporte cartular (papel) de este acto administrativo producido por medios electronicos en cumplimiento de la ley 527 de 1999 (Articulos 6 al 13) y de la ley 962 de 2005 (Articulo 6), es una reproduccion del documento original que se encuentra en formato electronico en la Base de Datos del RNDC en el Ministerio de Transporte, cuya representacion digital goza de autenticidad, integridad y no repudio";
      const disclaimerLines = pdf.splitTextToSize(disclaimer, 55);
      pdf.text(disclaimerLines, rightCol, y + 3);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("MANIFIESTO ELECTRONICO DE CARGA", midCol, y + 5, { align: "center" });
      
      pdf.setFontSize(9);
      pdf.text(settings.companyName || "TRANSPETROMIRA S.A.S", midCol, y + 11, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(`Nit: ${settings.companyNit}`, midCol, y + 15, { align: "center" });
      if (settings.companyAddress) pdf.text(settings.companyAddress, midCol, y + 19, { align: "center" });
      if (settings.companyPhone) pdf.text(`Tel: ${settings.companyPhone} - ${settings.companyCity || ""}`, midCol, y + 23, { align: "center" });

      const qrImg = new Image();
      qrImg.src = qrResult.qrDataUrl;
      await new Promise((resolve) => { qrImg.onload = resolve; });
      pdf.addImage(qrImg, "PNG", leftCol, y, 28, 28);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text(`Manifiesto: ${manifiesto.consecutivo}`, rightCol, y + 28);
      pdf.text(`Autorizacion: ${details.INGRESOID}`, rightCol, y + 32);

      y = 45;
      drawLine(y);
      y += 1;

      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, pageWidth - margin * 2, 10, "F");
      y += 3;
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6);
      pdf.text("FECHA EXPEDICION", leftCol, y);
      pdf.text("FECHA/HORA RADICACION", 50, y);
      pdf.text("TIPO MANIFIESTO", 95, y);
      pdf.text("ORIGEN DEL VIAJE", 130, y);
      pdf.text("DESTINO DEL VIAJE", 170, y);
      y += 4;
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text(details.FECHAEXPEDICIONMANIFIESTO || "", leftCol, y);
      pdf.text(details.FECHAEXPEDICIONMANIFIESTO || "", 50, y);
      pdf.text("General", 95, y);
      pdf.text(origName.substring(0, 18), 130, y);
      pdf.text(destName.substring(0, 18), 170, y);
      y += 5;

      y = drawSectionHeader("INFORMACION DEL VEHICULO Y CONDUCTORES", y);
      y += 2;

      labelValue("TITULAR MANIFIESTO:", details.NOMIDTITULARMANIFIESTOCARGA || manifiesto.numIdTitular, leftCol, y, 32);
      labelValue("DOCUMENTO:", `${manifiesto.tipoIdTitular}: ${manifiesto.numIdTitular}`, 85, y, 22);
      labelValue("TELEFONO:", associatedRow?.placaData?.propietarioId ? "" : "-", 140, y, 18);
      y += 4;
      labelValue("DIRECCION:", "-", leftCol, y, 20);
      labelValue("CIUDAD:", settings.companyCity || "-", 120, y, 15);
      y += 5;

      drawLine(y);
      y += 3;

      labelValue("PLACA:", details.NUMPLACA || "", leftCol, y, 12);
      labelValue("MARCA:", "-", 40, y, 12);
      labelValue("PL. SEMIREMOLQUE:", details.NUMPLACAREMOLQUE || "-", 70, y, 30);
      labelValue("CONFIG:", details.NUMPLACAREMOLQUE ? "3S2" : "C2", 115, y, 14);
      labelValue("PESO VACIO:", associatedRow?.placaData?.pesoVacio || "-", 145, y, 22);
      y += 4;
      labelValue("ASEGURADORA SOAT:", "-", leftCol, y, 32);
      labelValue("No. POLIZA:", "-", 70, y, 20);
      labelValue("VENCE SOAT:", associatedRow?.placaData?.venceSoat || "-", 120, y, 22);
      y += 5;

      drawLine(y);
      y += 3;

      const conductorNombre = associatedRow?.cedulaData?.nombre || details.NUMIDCONDUCTOR || "";
      labelValue("CONDUCTOR:", conductorNombre, leftCol, y, 22);
      labelValue("DOCUMENTO:", `CC: ${manifiesto.cedula}`, 85, y, 22);
      labelValue("No. LICENCIA:", "-", 145, y, 22);
      y += 4;
      labelValue("DIRECCION:", "-", leftCol, y, 20);
      labelValue("TELEFONO:", "-", 85, y, 18);
      labelValue("VENCE LIC:", associatedRow?.cedulaData?.venceLicencia || "-", 145, y, 20);
      y += 5;

      drawLine(y);
      y += 3;

      labelValue("POSEEDOR/TENEDOR:", details.NOMIDTITULARMANIFIESTOCARGA || "-", leftCol, y, 32);
      labelValue("DOCUMENTO:", `${manifiesto.tipoIdTitular}: ${manifiesto.numIdTitular}`, 85, y, 22);
      labelValue("CIUDAD:", "-", 160, y, 14);
      y += 4;
      labelValue("DIRECCION:", "-", leftCol, y, 20);
      labelValue("TELEFONO:", "-", 120, y, 18);
      y += 5;

      y = drawSectionHeader("INFORMACION DE LA MERCANCIA TRANSPORTADA", y);
      y += 3;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(5);
      pdf.text("Nro Remesa", leftCol, y);
      pdf.text("Und Med", 30, y);
      pdf.text("Cantidad", 48, y);
      pdf.text("Naturaleza", 65, y);
      pdf.text("Empaque", 85, y);
      pdf.text("Producto", 105, y);
      pdf.text("Remitente / Cargue", 135, y);
      pdf.text("Destinatario / Descargue", 170, y);
      y += 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5);
      const cantidadKg = associatedRemesa?.cantidadCargada || associatedRow?.toneladas ? (parseFloat(associatedRow?.toneladas || "0") * 1000).toString() : "0";
      pdf.text(String(manifiesto.consecutivoRemesa), leftCol, y);
      pdf.text("Kilogramos", 30, y);
      pdf.text(cantidadKg, 48, y);
      pdf.text("Carga Normal", 65, y);
      pdf.text("Gral. Fracc.", 85, y);
      pdf.text(cargoDesc.substring(0, 20), 105, y);
      pdf.text(associatedRow?.granja?.substring(0, 18) || "-", 135, y);
      pdf.text(associatedRow?.planta?.substring(0, 18) || "-", 170, y);
      y += 6;

      drawLine(y);
      y += 2;

      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, 70, 35, "F");
      pdf.rect(margin + 75, y, pageWidth - margin * 2 - 75, 35, "F");
      
      y += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("PRECIO DEL VIAJE", leftCol + 15, y);
      pdf.text("PAGO DEL SALDO", midCol + 25, y);
      y += 5;

      pdf.setFontSize(6);
      labelValue("VALOR TOTAL VIAJE:", `$${parseInt(details.VALORFLETEPACTADOVIAJE || String(manifiesto.valorFlete) || "0").toLocaleString()}`, leftCol, y, 30);
      labelValue("LUGAR DE PAGO:", settings.companyCity || "BOGOTA D.C.", midCol, y, 28);
      y += 4;
      
      const retencionFuente = Math.round(manifiesto.valorFlete * 0.01);
      labelValue("RETENCION FUENTE:", `$${retencionFuente.toLocaleString()}`, leftCol, y, 30);
      labelValue("FECHA:", manifiesto.fechaPagoSaldo || "", midCol, y, 14);
      y += 4;

      labelValue("RETENCION ICA:", `$${parseInt(details.RETENCIONICAMANIFIESTOCARGA || "0").toLocaleString()}`, leftCol, y, 30);
      labelValue("CARGUE PAGADO POR:", "DESTINATARIO", midCol, y, 32);
      y += 4;

      const valorNeto = manifiesto.valorFlete - retencionFuente;
      labelValue("VALOR NETO:", `$${valorNeto.toLocaleString()}`, leftCol, y, 30);
      labelValue("DESCARGUE PAGADO POR:", "DESTINATARIO", midCol, y, 36);
      y += 4;

      labelValue("ANTICIPO:", `$${parseInt(details.VALORANTICIPOMANIFIESTO || "0").toLocaleString()}`, leftCol, y, 30);
      y += 4;
      
      const saldo = valorNeto - parseInt(details.VALORANTICIPOMANIFIESTO || "0");
      labelValue("SALDO A PAGAR:", `$${saldo.toLocaleString()}`, leftCol, y, 30);
      y += 6;

      pdf.setFontSize(5);
      const valorEnLetras = `${Math.floor(manifiesto.valorFlete / 1000)} MIL PESOS M/CTE`;
      labelValue("VALOR EN LETRAS:", valorEnLetras, leftCol, y, 28);
      y += 6;

      drawLine(y);
      y += 3;

      pdf.setFontSize(5);
      pdf.setFont("helvetica", "normal");
      pdf.text("Si es victima de algun fraude o conoce de alguna irregularidad en el Registro Nacional de Despachos de Carga RNDC denuncielo a la Superintendencia", leftCol, y);
      y += 3;
      pdf.text("de Puertos y Transporte, en la linea gratuita nacional 018000 915615 y a traves del correo electronico: atencionciudadano@supertransporte.gov.co", leftCol, y);
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6);
      pdf.text("Firma y Huella TITULAR MANIFIESTO o ACEPTACION DIGITAL", leftCol + 20, y);
      pdf.text("Firma y Huella del CONDUCTOR o ACEPTACION DIGITAL", midCol + 25, y);
      y += 12;
      pdf.line(leftCol, y, leftCol + 65, y);
      pdf.line(midCol + 5, y, midCol + 70, y);

      pdf.addPage();
      y = 15;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("MANIFIESTO ELECTRONICO DE CARGA", midCol, y, { align: "center" });
      pdf.setFontSize(6);
      pdf.text("Hoja 2", pageWidth - 20, y);
      y += 5;
      pdf.setFontSize(8);
      pdf.text(settings.companyName || "TRANSPETROMIRA S.A.S", midCol, y, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text(`Nit: ${settings.companyNit}`, midCol, y + 4, { align: "center" });
      if (settings.companyAddress) pdf.text(settings.companyAddress, midCol, y + 7, { align: "center" });
      if (settings.companyPhone) pdf.text(`Tel: ${settings.companyPhone}`, midCol, y + 10, { align: "center" });

      pdf.setFont("helvetica", "bold");
      pdf.text(`Manifiesto: ${manifiesto.consecutivo}`, rightCol, y);
      pdf.text(`Autorizacion: ${details.INGRESOID}`, rightCol, y + 4);

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(5);
      const disclaimer2 = "Si es victima de algun fraude o conoce de alguna irregularidad en el Registro Nacional de Despachos de Carga RNDC denuncielo a la Superintendencia de Puertos y Transporte, en la linea gratuita nacional 018000 915615 y a traves del correo electronico: atencionciudadano@supertransporte.gov.co";
      const disclaimer2Lines = pdf.splitTextToSize(disclaimer2, 50);
      pdf.text(disclaimer2Lines, rightCol, y + 12);

      y += 30;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("Anexo: Tiempos y Plazos para cargue y descargue Literal 12 Art 8 Decreto 2092 de 2011", midCol, y, { align: "center" });
      y += 5;

      labelValue("Placa Vehiculo:", details.NUMPLACA || "", leftCol, y, 25);
      labelValue("Nombre del Conductor:", conductorNombre, 60, y, 35);
      labelValue("CC:", manifiesto.cedula, 150, y, 8);
      y += 6;

      drawLine(y);
      y += 3;

      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, y - 1, pageWidth - margin * 2, 8, "F");
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(5);
      pdf.text("Numero de", leftCol, y + 1);
      pdf.text("Remesa", leftCol, y + 4);
      pdf.text("Hrs Pactadas", 30, y + 1);
      pdf.text("Cargue  Desc.", 30, y + 4);
      pdf.text("Llegada Cargue", 55, y + 1);
      pdf.text("Fecha    Hora", 55, y + 4);
      pdf.text("Salida Cargue", 80, y + 1);
      pdf.text("Fecha    Hora", 80, y + 4);
      pdf.text("Firma", 105, y + 2);
      pdf.text("Remit.", 105, y + 5);
      pdf.text("Firma", 118, y + 2);
      pdf.text("Cond.", 118, y + 5);
      pdf.text("Llegada Descargue", 130, y + 1);
      pdf.text("Fecha      Hora", 130, y + 4);
      pdf.text("Salida Descargue", 158, y + 1);
      pdf.text("Fecha      Hora", 158, y + 4);
      pdf.text("Firma", 185, y + 2);
      pdf.text("Dest.", 185, y + 5);
      pdf.text("Firma", 198, y + 2);
      pdf.text("Cond.", 198, y + 5);
      y += 9;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text(String(manifiesto.consecutivoRemesa), leftCol, y);
      pdf.text("0.00   2.00", 32, y);
      pdf.text(associatedRemesa?.fechaCargue || "-", 55, y);
      pdf.text(associatedRemesa?.horaCargue || "-", 68, y);
      pdf.text("-", 80, y);
      pdf.text("-", 93, y);
      pdf.text(associatedRemesa?.fechaDescargue || "-", 132, y);
      pdf.text(associatedRemesa?.horaDescargue || "-", 148, y);
      pdf.text("-", 160, y);
      pdf.text("-", 173, y);
      y += 20;

      pdf.save(`Manifiesto_${manifiesto.consecutivo}_${details.INGRESOID}.pdf`);
      toast({ title: "PDF Generado", description: `Manifiesto ${manifiesto.consecutivo} descargado` });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Error al generar el PDF", variant: "destructive" });
    }
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
                    <CardTitle className="text-sm">Despachos Guardados ({savedDespachos.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {savedDespachos.map((d: any) => (
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
                    </div>
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
                    <CardTitle className="text-sm">Despachos Guardados</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {savedDespachos.map((d: any) => (
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
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                        ) : (
                          <>Enviar al RNDC <CheckCircle className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
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
                    <Table>
                      <TableHeader>
                        <TableRow>
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
    </div>
  );
}
