import { useState, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, History, User, Loader2, CheckCircle, XCircle, Eye, TableIcon, Download, Upload, FileSpreadsheet, Clock, FileCode } from "lucide-react";
import * as XLSX from "xlsx";
import { XmlViewer } from "@/components/xml-viewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RndcQuery {
  id: string;
  queryType: string;
  queryName: string;
  numNitEmpresa: string | null;
  numIdTercero: string | null;
  xmlRequest: string;
  xmlResponse: string | null;
  responseData: string | null;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  createdAt: string;
}

interface TerceroDocument {
  ingresoid: string;
  fechaing: string;
  codtipoidtercero: string;
  nomidtercero: string;
  primerapellidoidtercero: string;
  segundoapellidoidtercero: string;
  numtelefonocontacto: string;
  nomenclaturadireccion: string;
  codmunicipiorndc: string;
  codsedetercero: string;
  nomsedetercero: string;
  numlicenciaconduccion: string;
  codcategorialicenciaconduccion: string;
  fechavencimientolicencia: string;
  latitud: string;
  longitud: string;
  regimensimple: string;
}

const QUERY_TYPES = [
  { value: "terceros", label: "Terceros", tipo: "3", procesoid: "11" },
];

interface ManifiestoExcelRow {
  CONSECUTIVOREMESA: string | number;
}

interface ManifiestoResult {
  consecutivoRemesa: string;
  ingresoidManifiesto: string;
  fechaIngreso: string;
  status: "success" | "error" | "pending";
  errorMessage?: string;
}

interface ControlPointData {
  codpuntocontrol: string;
  codmunicipio: string;
  direccion: string;
  fechacita: string;
  horacita: string;
  latitud: string;
  longitud: string;
  tiempopactado: string;
}

interface LogisticsResult {
  consecutivoRemesa: string;
  ingresoidManifiesto: string;
  numManifiestoCarga: string;
  numPlaca: string;
  fechaExpedicion: string;
  controlPoints: ControlPointData[];
  status: "success" | "error" | "pending";
  errorMessage?: string;
}

interface GeneratedSubmission {
  ingresoidmanifiesto: string;
  numidgps: string;
  numplaca: string;
  codpuntocontrol: string;
  latitud: string;
  longitud: string;
  fechallegada: string;
  horallegada: string;
  fechasalida: string;
  horasalida: string;
  xmlRequest: string;
}

interface RndcBatch {
  id: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  status: string;
  createdAt: string;
}

interface RndcSubmission {
  id: string;
  batchId: string;
  ingresoidmanifiesto: string;
  numidgps: string;
  numplaca: string;
  codpuntocontrol: string;
  latitud: string;
  longitud: string;
  fechallegada: string;
  horallegada: string;
  fechasalida: string;
  horasalida: string;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  xmlRequest: string;
  xmlResponse: string | null;
  createdAt: string;
  processedAt: string | null;
}

const TERCEROS_VARIABLES = "INGRESOID,FECHAING,CODTIPOIDTERCERO,NOMIDTERCERO,PRIMERAPELLIDOIDTERCERO,SEGUNDOAPELLIDOIDTERCERO,NUMTELEFONOCONTACTO,NOMENCLATURADIRECCION,CODMUNICIPIORNDC,CODSEDETERCERO,NOMSEDETERCERO,NUMLICENCIACONDUCCION,CODCATEGORIALICENCIACONDUCCION,FECHAVENCIMIENTOLICENCIA,LATITUD,LONGITUD,REGIMENSIMPLE";

const TERCEROS_COLUMNS = [
  { key: "ingresoid", label: "ID Ingreso" },
  { key: "fechaing", label: "Fecha Ingreso" },
  { key: "codsedetercero", label: "Cod Sede" },
  { key: "nomsedetercero", label: "Nombre Sede" },
  { key: "nomenclaturadireccion", label: "Dirección" },
  { key: "codmunicipiorndc", label: "Cod Municipio" },
  { key: "numtelefonocontacto", label: "Teléfono" },
  { key: "latitud", label: "Latitud" },
  { key: "longitud", label: "Longitud" },
];

function parseDocumentsFromXml(xmlString: string): TerceroDocument[] {
  const documents: TerceroDocument[] = [];
  const docRegex = /<documento>([\s\S]*?)<\/documento>/g;
  let match;

  while ((match = docRegex.exec(xmlString)) !== null) {
    const docContent = match[1];
    const doc: any = {};
    
    const fields = [
      'ingresoid', 'fechaing', 'codtipoidtercero', 'nomidtercero',
      'primerapellidoidtercero', 'segundoapellidoidtercero', 'numtelefonocontacto',
      'nomenclaturadireccion', 'codmunicipiorndc', 'codsedetercero', 'nomsedetercero',
      'numlicenciaconduccion', 'codcategorialicenciaconduccion', 'fechavencimientolicencia',
      'latitud', 'longitud', 'regimensimple'
    ];

    fields.forEach(field => {
      const fieldRegex = new RegExp(`<${field}>([^<]*)</${field}>`);
      const fieldMatch = docContent.match(fieldRegex);
      doc[field] = fieldMatch ? fieldMatch[1].trim() : '';
    });

    documents.push(doc as TerceroDocument);
  }

  return documents;
}

export default function Queries() {
  const { settings, getActiveWsUrl } = useSettings();
  const [queryType, setQueryType] = useState("terceros");
  const [numIdTercero, setNumIdTercero] = useState("");
  const [generatedXml, setGeneratedXml] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [parsedDocuments, setParsedDocuments] = useState<TerceroDocument[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<RndcQuery | null>(null);
  const [showXmlResponse, setShowXmlResponse] = useState(false);
  const [filterWithCoords, setFilterWithCoords] = useState(false);

  // Bulk manifest query states
  const [manifiestoExcelData, setManifiestoExcelData] = useState<ManifiestoExcelRow[]>([]);
  const [manifiestoResults, setManifiestoResults] = useState<ManifiestoResult[]>([]);
  const [isQueryingManifiestos, setIsQueryingManifiestos] = useState(false);
  const [manifiestoProgress, setManifiestoProgress] = useState({ current: 0, total: 0 });
  const manifiestoFileInputRef = useRef<HTMLInputElement>(null);

  // Logistics times query states
  const [logisticsResults, setLogisticsResults] = useState<LogisticsResult[]>([]);
  const [isQueryingLogistics, setIsQueryingLogistics] = useState(false);
  const [logisticsProgress, setLogisticsProgress] = useState({ current: 0, total: 0 });
  const [showLogisticsResults, setShowLogisticsResults] = useState(false);

  // Generated XMLs states
  const [generatedSubmissions, setGeneratedSubmissions] = useState<GeneratedSubmission[]>([]);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [selectedXmlPreview, setSelectedXmlPreview] = useState<GeneratedSubmission | null>(null);

  // Batch results tracking
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentBatch, setCurrentBatch] = useState<RndcBatch | null>(null);
  const [currentBatchResults, setCurrentBatchResults] = useState<RndcSubmission[]>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<RndcSubmission | null>(null);

  const filteredDocuments = filterWithCoords 
    ? parsedDocuments.filter(doc => doc.latitud && doc.longitud && doc.latitud.trim() !== '' && doc.longitud.trim() !== '')
    : parsedDocuments;

  // Fetch batch results function
  const fetchBatchResults = useCallback(async (batchId: string) => {
    try {
      const [batchRes, submissionsRes] = await Promise.all([
        fetch(`/api/rndc/batches/${batchId}`),
        fetch(`/api/rndc/submissions?batchId=${batchId}`)
      ]);

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        if (batchData.success && batchData.batch) {
          setCurrentBatch(batchData.batch);
        }
      }

      if (submissionsRes.ok) {
        const submissionsData = await submissionsRes.json();
        if (submissionsData.success && submissionsData.submissions) {
          setCurrentBatchResults(submissionsData.submissions);
        }
      }
    } catch (error) {
      console.error("Error fetching batch results:", error);
    }
  }, []);

  // Polling effect for batch results
  useEffect(() => {
    if (!currentBatchId || !isPolling) return;

    const intervalId = setInterval(async () => {
      await fetchBatchResults(currentBatchId);

      // Check if batch is complete
      if (currentBatch && currentBatch.pendingCount === 0) {
        setIsPolling(false);
        toast({
          title: "Lote Completado",
          description: `Exitosos: ${currentBatch.successCount}, Errores: ${currentBatch.errorCount}`,
        });
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [currentBatchId, isPolling, currentBatch, fetchBatchResults]);

  const exportToExcel = () => {
    const dataToExport = filteredDocuments.map(doc => ({
      'ID Ingreso': doc.ingresoid,
      'Fecha Ingreso': doc.fechaing,
      'Tipo ID': doc.codtipoidtercero,
      'Nombre': doc.nomidtercero,
      'Primer Apellido': doc.primerapellidoidtercero,
      'Segundo Apellido': doc.segundoapellidoidtercero,
      'Teléfono': doc.numtelefonocontacto,
      'Dirección': doc.nomenclaturadireccion,
      'Cod Municipio': doc.codmunicipiorndc,
      'Cod Sede': doc.codsedetercero,
      'Nombre Sede': doc.nomsedetercero,
      'Licencia': doc.numlicenciaconduccion,
      'Categoría Licencia': doc.codcategorialicenciaconduccion,
      'Vencimiento Licencia': doc.fechavencimientolicencia,
      'Latitud': doc.latitud,
      'Longitud': doc.longitud,
      'Régimen Simple': doc.regimensimple,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terceros");
    XLSX.writeFile(wb, `terceros_${numIdTercero}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: `Se exportaron ${filteredDocuments.length} registros a Excel`,
    });
  };

  const handleManifiestoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as ManifiestoExcelRow[];
        
        setManifiestoExcelData(jsonData);
        setManifiestoResults([]);
        toast({
          title: "Archivo Cargado",
          description: `Se encontraron ${jsonData.length} registros con CONSECUTIVOREMESA`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo leer el archivo Excel",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const generateManifiestoXml = (consecutivoRemesa: string): string => {
    return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>3</tipo>
<procesoid>4</procesoid>
</solicitud>
<variables>
INGRESOID,FECHAING
</variables>
<documento>
<NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
<NUMMANIFIESTOCARGA>${consecutivoRemesa}</NUMMANIFIESTOCARGA>
</documento>
</root>`;
  };

  const parseManifiestoResponse = (xmlResponse: string): { ingresoid: string; fechaing: string } | null => {
    const ingresoidMatch = xmlResponse.match(/<ingresoid>([^<]*)<\/ingresoid>/);
    const fechaingMatch = xmlResponse.match(/<fechaing>([^<]*)<\/fechaing>/);
    
    if (ingresoidMatch) {
      return {
        ingresoid: ingresoidMatch[1].trim(),
        fechaing: fechaingMatch ? fechaingMatch[1].trim() : '',
      };
    }
    return null;
  };

  const handleQueryManifiestos = async () => {
    if (manifiestoExcelData.length === 0) return;

    // Validate data first
    const validData = manifiestoExcelData.filter(row => {
      const val = row.CONSECUTIVOREMESA;
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    if (validData.length === 0) {
      toast({
        title: "Error",
        description: "No se encontraron registros válidos con CONSECUTIVOREMESA",
        variant: "destructive",
      });
      return;
    }

    setIsQueryingManifiestos(true);
    setManifiestoProgress({ current: 0, total: validData.length });
    const results: ManifiestoResult[] = [];

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    for (let i = 0; i < validData.length; i++) {
      const row = validData[i];
      const consecutivo = String(row.CONSECUTIVOREMESA).trim();
      const xmlRequest = generateManifiestoXml(consecutivo);

      try {
        const response = await fetch("/api/rndc/queries/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queryType: "manifiesto_lookup",
            queryName: "Búsqueda Manifiesto",
            numNitEmpresa: settings.companyNit,
            numIdTercero: consecutivo,
            xmlRequest,
            wsUrl,
          }),
        });

        const result = await response.json();
        
        if (result.success && result.query?.xmlResponse) {
          const parsed = parseManifiestoResponse(result.query.xmlResponse);
          if (parsed) {
            results.push({
              consecutivoRemesa: consecutivo,
              ingresoidManifiesto: parsed.ingresoid,
              fechaIngreso: parsed.fechaing,
              status: "success",
            });
          } else {
            results.push({
              consecutivoRemesa: consecutivo,
              ingresoidManifiesto: "",
              fechaIngreso: "",
              status: "error",
              errorMessage: "No se encontró el manifiesto",
            });
          }
        } else {
          results.push({
            consecutivoRemesa: consecutivo,
            ingresoidManifiesto: "",
            fechaIngreso: "",
            status: "error",
            errorMessage: result.response?.message || result.message || "Error en consulta",
          });
        }
      } catch (error) {
        results.push({
          consecutivoRemesa: consecutivo,
          ingresoidManifiesto: "",
          fechaIngreso: "",
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Error de conexión",
        });
      }

      setManifiestoProgress({ current: i + 1, total: validData.length });
      setManifiestoResults([...results]);
    }

    setIsQueryingManifiestos(false);
    refetchQueries();
    
    const successCount = results.filter(r => r.status === "success").length;
    toast({
      title: "Consulta Completada",
      description: `${successCount} de ${results.length} manifiestos encontrados`,
      className: successCount === results.length ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
    });
  };

  const exportManifiestoResults = () => {
    if (manifiestoResults.length === 0) return;

    const dataToExport = manifiestoResults.map(r => ({
      'CONSECUTIVOREMESA': r.consecutivoRemesa,
      'INGRESOIDMANIFIESTO': r.ingresoidManifiesto,
      'FECHA INGRESO': r.fechaIngreso,
      'ESTADO': r.status === "success" ? "Encontrado" : "Error",
      'MENSAJE': r.errorMessage || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manifiestos");
    XLSX.writeFile(wb, `manifiestos_lookup_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: `Se exportaron ${manifiestoResults.length} registros`,
    });
  };

  const generateLogisticsXml = (ingresoidManifiesto: string): string => {
    return `<?xml version='1.0' encoding='iso-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameGps}</username>
<password>${settings.passwordGps}</password>
</acceso>
<solicitud>
<tipo>9</tipo>
<procesoid>4</procesoid>
</solicitud>
<documento>
<numidgps>${settings.companyNit}</numidgps>
<ingresoidmanifiesto>${ingresoidManifiesto}</ingresoidmanifiesto>
</documento>
</root>`;
  };

  const parseLogisticsResponse = (xmlResponse: string): { 
    numManifiestoCarga: string; 
    numPlaca: string; 
    fechaExpedicion: string;
    controlPoints: ControlPointData[] 
  } | null => {
    const numManifiestoMatch = xmlResponse.match(/<nummanifiestocarga>([^<]*)<\/nummanifiestocarga>/i);
    const numPlacaMatch = xmlResponse.match(/<numplaca>([^<]*)<\/numplaca>/i);
    const fechaExpedicionMatch = xmlResponse.match(/<fechaexpedicionmanifiesto>([^<]*)<\/fechaexpedicionmanifiesto>/i);
    
    const controlPoints: ControlPointData[] = [];
    const puntosMatch = xmlResponse.match(/<puntoscontrol>([\s\S]*?)<\/puntoscontrol>/i);
    
    if (puntosMatch) {
      const puntosContent = puntosMatch[1];
      const puntoRegex = /<puntocontrol>([\s\S]*?)<\/puntocontrol>/gi;
      let puntoMatch;
      
      while ((puntoMatch = puntoRegex.exec(puntosContent)) !== null) {
        const puntoContent = puntoMatch[1];
        const punto: ControlPointData = {
          codpuntocontrol: (puntoContent.match(/<codpuntocontrol>([^<]*)<\/codpuntocontrol>/i) || [])[1]?.trim() || '',
          codmunicipio: (puntoContent.match(/<codmunicipio>([^<]*)<\/codmunicipio>/i) || [])[1]?.trim() || '',
          direccion: (puntoContent.match(/<direccion>([^<]*)<\/direccion>/i) || [])[1]?.trim() || '',
          fechacita: (puntoContent.match(/<fechacita>([^<]*)<\/fechacita>/i) || [])[1]?.trim() || '',
          horacita: (puntoContent.match(/<horacita>([^<]*)<\/horacita>/i) || [])[1]?.trim() || '',
          latitud: (puntoContent.match(/<latitud>([^<]*)<\/latitud>/i) || [])[1]?.trim() || '',
          longitud: (puntoContent.match(/<longitud>([^<]*)<\/longitud>/i) || [])[1]?.trim() || '',
          tiempopactado: (puntoContent.match(/<tiempopactado>([^<]*)<\/tiempopactado>/i) || [])[1]?.trim() || '',
        };
        controlPoints.push(punto);
      }
    }
    
    if (numManifiestoMatch || controlPoints.length > 0) {
      return {
        numManifiestoCarga: numManifiestoMatch?.[1]?.trim() || '',
        numPlaca: numPlacaMatch?.[1]?.trim() || '',
        fechaExpedicion: fechaExpedicionMatch?.[1]?.trim() || '',
        controlPoints,
      };
    }
    return null;
  };

  const handleQueryLogistics = async () => {
    const successResults = manifiestoResults.filter(r => r.status === "success" && r.ingresoidManifiesto);
    if (successResults.length === 0) {
      toast({
        title: "Sin manifiestos",
        description: "Primero consulte los INGRESOIDMANIFIESTO",
        variant: "destructive",
      });
      return;
    }

    setIsQueryingLogistics(true);
    setLogisticsProgress({ current: 0, total: successResults.length });
    const results: LogisticsResult[] = [];

    const wsUrl = getActiveWsUrl();

    for (let i = 0; i < successResults.length; i++) {
      const manifest = successResults[i];
      const xmlRequest = generateLogisticsXml(manifest.ingresoidManifiesto);

      try {
        const response = await fetch("/api/rndc/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queryType: "SPECIFIC",
            numIdGps: settings.companyNit,
            manifestId: manifest.ingresoidManifiesto,
            xmlRequest,
            wsUrl,
          }),
        });

        const result = await response.json();
        
        if (result.success && result.rawXml) {
          const parsed = parseLogisticsResponse(result.rawXml);
          if (parsed) {
            results.push({
              consecutivoRemesa: manifest.consecutivoRemesa,
              ingresoidManifiesto: manifest.ingresoidManifiesto,
              numManifiestoCarga: parsed.numManifiestoCarga,
              numPlaca: parsed.numPlaca,
              fechaExpedicion: parsed.fechaExpedicion,
              controlPoints: parsed.controlPoints,
              status: "success",
            });
          } else {
            results.push({
              consecutivoRemesa: manifest.consecutivoRemesa,
              ingresoidManifiesto: manifest.ingresoidManifiesto,
              numManifiestoCarga: "",
              numPlaca: "",
              fechaExpedicion: "",
              controlPoints: [],
              status: "error",
              errorMessage: "Sin puntos de control",
            });
          }
        } else {
          results.push({
            consecutivoRemesa: manifest.consecutivoRemesa,
            ingresoidManifiesto: manifest.ingresoidManifiesto,
            numManifiestoCarga: "",
            numPlaca: "",
            fechaExpedicion: "",
            controlPoints: [],
            status: "error",
            errorMessage: result.message || "Error en consulta",
          });
        }
      } catch (error) {
        results.push({
          consecutivoRemesa: manifest.consecutivoRemesa,
          ingresoidManifiesto: manifest.ingresoidManifiesto,
          numManifiestoCarga: "",
          numPlaca: "",
          fechaExpedicion: "",
          controlPoints: [],
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Error de conexión",
        });
      }

      setLogisticsProgress({ current: i + 1, total: successResults.length });
      setLogisticsResults([...results]);
    }

    setIsQueryingLogistics(false);
    setShowLogisticsResults(true);
    
    const successCount = results.filter(r => r.status === "success").length;
    toast({
      title: "Consulta Completada",
      description: `${successCount} de ${results.length} tiempos logísticos encontrados`,
      className: successCount === results.length ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
    });
  };

  const exportLogisticsResults = () => {
    if (logisticsResults.length === 0) return;

    const dataToExport: any[] = [];
    
    logisticsResults.forEach(r => {
      if (r.controlPoints.length > 0) {
        r.controlPoints.forEach((cp, idx) => {
          dataToExport.push({
            'CONSECUTIVOREMESA': r.consecutivoRemesa,
            'INGRESOIDMANIFIESTO': r.ingresoidManifiesto,
            'NUM MANIFIESTO': r.numManifiestoCarga,
            'PLACA': r.numPlaca,
            'FECHA EXPEDICION': r.fechaExpedicion,
            'PUNTO CONTROL': cp.codpuntocontrol,
            'COD MUNICIPIO': cp.codmunicipio,
            'DIRECCION': cp.direccion,
            'FECHA CITA': cp.fechacita,
            'HORA CITA': cp.horacita,
            'LATITUD': cp.latitud,
            'LONGITUD': cp.longitud,
            'TIEMPO PACTADO': cp.tiempopactado,
            'ESTADO': 'Encontrado',
          });
        });
      } else {
        dataToExport.push({
          'CONSECUTIVOREMESA': r.consecutivoRemesa,
          'INGRESOIDMANIFIESTO': r.ingresoidManifiesto,
          'NUM MANIFIESTO': r.numManifiestoCarga,
          'PLACA': r.numPlaca,
          'FECHA EXPEDICION': r.fechaExpedicion,
          'PUNTO CONTROL': '',
          'COD MUNICIPIO': '',
          'DIRECCION': '',
          'FECHA CITA': '',
          'HORA CITA': '',
          'LATITUD': '',
          'LONGITUD': '',
          'TIEMPO PACTADO': '',
          'ESTADO': r.status === "success" ? 'Sin puntos' : r.errorMessage || 'Error',
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tiempos Logisticos");
    XLSX.writeFile(wb, `tiempos_logisticos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: `Se exportaron ${dataToExport.length} registros`,
    });
  };

  const getShiftedTime = (dateStr: string, timeStr: string, minAdd: number) => {
    let d = new Date();
    
    // Handle different date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY or DD-MM-YYYY
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD or YYYY/MM/DD
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }

    // Handle time string HH:MM or HH:MM:SS
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      d.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
    }

    d.setMinutes(d.getMinutes() + minAdd);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return { d: `${dd}/${mm}/${yyyy}`, t: `${hh}:${min}` };
  };

  const handleGenerateXmlsFromLogistics = () => {
    const successResults = logisticsResults.filter(r => r.status === "success" && r.controlPoints.length > 0);
    
    if (successResults.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay tiempos logísticos con puntos de control para generar XMLs",
        variant: "destructive",
      });
      return;
    }

    const submissions: GeneratedSubmission[] = [];

    successResults.forEach(result => {
      result.controlPoints.forEach(cp => {
        const arrOffset = Math.floor(Math.random() * (90 - 60 + 1)) + 60;
        const stayDuration = Math.floor(Math.random() * (140 - 90 + 1)) + 90;
        const totalDepOffset = arrOffset + stayDuration;

        const arrivalTime = getShiftedTime(cp.fechacita, cp.horacita, arrOffset);
        const departureTime = getShiftedTime(cp.fechacita, cp.horacita, totalDepOffset);

        const xmlRequest = `<?xml version='1.0' encoding='iso-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameGps}</username>
<password>${settings.passwordGps}</password>
</acceso>
<solicitud>
<tipo>1</tipo>
<procesoid>60</procesoid>
</solicitud>
<variables>
<numidgps>${settings.companyNit}</numidgps>
<ingresoidmanifiesto>${result.ingresoidManifiesto}</ingresoidmanifiesto>
<numplaca>${result.numPlaca}</numplaca>
<codpuntocontrol>${cp.codpuntocontrol}</codpuntocontrol>
<latitud>${cp.latitud}</latitud>
<longitud>${cp.longitud}</longitud>
<fechallegada>${arrivalTime.d}</fechallegada>
<horallegada>${arrivalTime.t}</horallegada>
<fechasalida>${departureTime.d}</fechasalida>
<horasalida>${departureTime.t}</horasalida>
</variables>
</root>`;

        submissions.push({
          ingresoidmanifiesto: result.ingresoidManifiesto,
          numidgps: settings.companyNit,
          numplaca: result.numPlaca,
          codpuntocontrol: cp.codpuntocontrol,
          latitud: cp.latitud,
          longitud: cp.longitud,
          fechallegada: arrivalTime.d,
          horallegada: arrivalTime.t,
          fechasalida: departureTime.d,
          horasalida: departureTime.t,
          xmlRequest,
        });
      });
    });

    setGeneratedSubmissions(submissions);
    toast({
      title: "XMLs Generados",
      description: `${submissions.length} XMLs listos para enviar al RNDC`,
    });
  };

  const handleSendGeneratedBatch = async () => {
    if (generatedSubmissions.length === 0) {
      toast({ title: "Error", description: "No hay XMLs generados para enviar", variant: "destructive" });
      return;
    }

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    if (!wsUrl) {
      toast({ title: "Error", description: "Configure la URL del servicio web en Configuración", variant: "destructive" });
      return;
    }

    console.log("[Queries] Sending batch:", { count: generatedSubmissions.length, wsUrl });

    setIsSendingBatch(true);
    try {
      const response = await fetch("/api/rndc/submit-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: generatedSubmissions, wsUrl }),
      });

      const result = await response.json();
      console.log("[Queries] Batch response:", result);

      if (result.success && result.batchId) {
        // Clear previous batch state before starting new one
        setCurrentBatch(null);
        setCurrentBatchResults([]);
        setCurrentBatchId(result.batchId);
        setShowBatchResults(true);
        setIsPolling(true);
        await fetchBatchResults(result.batchId);
        toast({
          title: "Lote Creado",
          description: `Procesando ${generatedSubmissions.length} registros...`,
          className: "bg-blue-50 border-blue-200",
        });
        setGeneratedSubmissions([]);
        refetchBatches();
      } else {
        toast({ title: "Error", description: result.message || "Error al enviar lote", variant: "destructive" });
      }
    } catch (error) {
      console.error("[Queries] Batch error:", error);
      toast({ title: "Error", description: "Error de conexión al servidor", variant: "destructive" });
    }
    setIsSendingBatch(false);
  };

  const exportGeneratedSubmissions = () => {
    if (generatedSubmissions.length === 0) return;

    const dataToExport = generatedSubmissions.map(sub => ({
      'INGRESOIDMANIFIESTO': sub.ingresoidmanifiesto,
      'NUMIDGPS': sub.numidgps,
      'PLACA': sub.numplaca,
      'PUNTO CONTROL': sub.codpuntocontrol,
      'LATITUD': sub.latitud,
      'LONGITUD': sub.longitud,
      'FECHA LLEGADA': sub.fechallegada,
      'HORA LLEGADA': sub.horallegada,
      'FECHA SALIDA': sub.fechasalida,
      'HORA SALIDA': sub.horasalida,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "XMLs Generados");
    XLSX.writeFile(wb, `xmls_generados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: `Se exportaron ${generatedSubmissions.length} registros`,
    });
  };

  const { data: queriesData, refetch: refetchQueries } = useQuery({
    queryKey: ["/api/rndc/queries"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/queries?limit=50");
      return res.json();
    },
  });

  const queries: RndcQuery[] = queriesData?.queries || [];

  // Batch history query
  const { data: batchesData, refetch: refetchBatches } = useQuery({
    queryKey: ["/api/rndc/batches"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/batches?limit=20");
      return res.json();
    },
  });

  const batches: RndcBatch[] = batchesData?.batches || [];

  const viewBatchDetails = async (batchId: string) => {
    setCurrentBatchId(batchId);
    setShowBatchResults(true);
    await fetchBatchResults(batchId);
  };

  const generateXml = () => {
    if (!numIdTercero.trim()) {
      toast({
        title: "Campo requerido",
        description: "Ingrese el número de identificación del tercero",
        variant: "destructive",
      });
      return;
    }

    const queryConfig = QUERY_TYPES.find(q => q.value === queryType);
    if (!queryConfig) return;

    const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>${queryConfig.tipo}</tipo>
<procesoid>${queryConfig.procesoid}</procesoid>
</solicitud>
<variables>
${TERCEROS_VARIABLES}
</variables>
<documento>
<NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
<NUMIDTERCERO>${numIdTercero}</NUMIDTERCERO>
</documento>
</root>`;

    setGeneratedXml(xml);
    setLastResponse(null);
    setParsedDocuments([]);
  };

  const handleSubmit = async () => {
    if (!generatedXml) {
      toast({
        title: "Error",
        description: "Primero genere el XML de consulta",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setParsedDocuments([]);
    try {
      const wsUrl = settings.wsEnvironment === "production" 
        ? settings.wsUrlProd 
        : settings.wsUrlTest;

      const queryConfig = QUERY_TYPES.find(q => q.value === queryType);

      const response = await apiRequest("POST", "/api/rndc/queries/execute", {
        queryType,
        queryName: queryConfig?.label || queryType,
        numNitEmpresa: settings.companyNit,
        numIdTercero,
        xmlRequest: generatedXml,
        wsUrl,
      });

      const result = await response.json();
      setLastResponse(result);
      refetchQueries();

      if (result.success && result.query?.xmlResponse) {
        const docs = parseDocumentsFromXml(result.query.xmlResponse);
        setParsedDocuments(docs);
        
        if (docs.length > 0) {
          toast({
            title: "Consulta exitosa",
            description: `Se encontraron ${docs.length} registros`,
          });
        }
      }

      if (result.success && result.response?.success) {
        if (parsedDocuments.length === 0) {
          toast({
            title: "Consulta exitosa",
            description: `Código: ${result.response.code}`,
          });
        }
      } else if (!result.success || !result.response?.success) {
        toast({
          title: "Error en consulta",
          description: result.response?.message || result.message || "Error desconocido",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al ejecutar consulta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentsFromQuery = (query: RndcQuery): TerceroDocument[] => {
    if (query.xmlResponse) {
      return parseDocumentsFromXml(query.xmlResponse);
    }
    return [];
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Consultas RNDC</h1>
          <p className="text-muted-foreground">Consulte información en el sistema RNDC</p>
        </div>

        <Tabs defaultValue="consultar" className="w-full">
          <TabsList>
            <TabsTrigger value="consultar" data-testid="tab-consultar">
              <Search className="mr-2 h-4 w-4" /> Consultar
            </TabsTrigger>
            <TabsTrigger value="masiva" data-testid="tab-masiva">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Consulta Masiva
            </TabsTrigger>
            <TabsTrigger value="historial" data-testid="tab-historial">
              <History className="mr-2 h-4 w-4" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consultar" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Consulta de Terceros
                  </CardTitle>
                  <CardDescription>
                    Consulte información de un tercero registrado en el RNDC
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Consulta</Label>
                    <Select value={queryType} onValueChange={setQueryType}>
                      <SelectTrigger data-testid="select-query-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUERY_TYPES.map((qt) => (
                          <SelectItem key={qt.value} value={qt.value}>
                            {qt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numIdTercero">Número de Identificación del Tercero</Label>
                    <Input
                      id="numIdTercero"
                      value={numIdTercero}
                      onChange={(e) => setNumIdTercero(e.target.value)}
                      placeholder="Ej: 8600588314"
                      data-testid="input-num-id-tercero"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={generateXml} variant="outline" className="flex-1" data-testid="button-generate-xml">
                      <Search className="mr-2 h-4 w-4" /> Generar XML
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={!generatedXml || isSubmitting}
                      className="flex-1"
                      data-testid="button-submit-query"
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Enviar al RNDC
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa XML</CardTitle>
                  <CardDescription>XML que se enviará al RNDC</CardDescription>
                </CardHeader>
                <CardContent>
                  {generatedXml ? (
                    <XmlViewer xml={generatedXml} />
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      Complete el formulario y genere el XML
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {lastResponse && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastResponse.response?.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      Respuesta del RNDC
                      {parsedDocuments.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({filterWithCoords ? `${filteredDocuments.length} de ${parsedDocuments.length}` : parsedDocuments.length} registros)
                        </span>
                      )}
                    </div>
                    {lastResponse.query?.xmlResponse && (
                      <Button variant="outline" size="sm" onClick={() => setShowXmlResponse(!showXmlResponse)}>
                        {showXmlResponse ? "Ver Tabla" : "Ver XML"}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Código</Label>
                      <p className="font-mono">{lastResponse.response?.code || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Mensaje</Label>
                      <p>{lastResponse.response?.message || "N/A"}</p>
                    </div>
                  </div>

                  {showXmlResponse && lastResponse.query?.xmlResponse ? (
                    <div>
                      <Label className="text-muted-foreground mb-2 block">XML Respuesta</Label>
                      <XmlViewer xml={lastResponse.query.xmlResponse} />
                    </div>
                  ) : parsedDocuments.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          Documentos Encontrados
                        </Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterWithCoords}
                              onChange={(e) => setFilterWithCoords(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            Solo con coordenadas
                          </label>
                          <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
                            <Download className="mr-2 h-4 w-4" /> Exportar Excel
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[400px] rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {TERCEROS_COLUMNS.map((col) => (
                                <TableHead key={col.key} className="whitespace-nowrap text-xs">
                                  {col.label}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDocuments.map((doc, idx) => (
                              <TableRow key={idx}>
                                {TERCEROS_COLUMNS.map((col) => (
                                  <TableCell key={col.key} className="text-xs whitespace-nowrap">
                                    {(doc as any)[col.key] || "-"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="masiva" className="space-y-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Consulta Masiva de Manifiestos</h3>
                  <p className="text-sm text-muted-foreground">
                    Suba un Excel con la columna CONSECUTIVOREMESA para obtener los INGRESOIDMANIFIESTO
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  ref={manifiestoFileInputRef}
                  onChange={handleManifiestoFileUpload}
                  data-testid="input-manifiesto-file"
                />
                <Button onClick={() => manifiestoFileInputRef.current?.click()} data-testid="button-select-manifiesto-file">
                  <Upload className="mr-2 h-4 w-4" /> Seleccionar Archivo Excel
                </Button>
              </CardContent>
            </Card>

            {manifiestoExcelData.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Datos Cargados</CardTitle>
                    <CardDescription>{manifiestoExcelData.length} registros con CONSECUTIVOREMESA</CardDescription>
                  </div>
                  <Button 
                    onClick={handleQueryManifiestos} 
                    disabled={isQueryingManifiestos}
                    data-testid="button-query-manifiestos"
                  >
                    {isQueryingManifiestos ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {manifiestoProgress.current}/{manifiestoProgress.total}
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" /> Consultar al RNDC
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CONSECUTIVOREMESA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manifiestoExcelData.slice(0, 20).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{String(row.CONSECUTIVOREMESA)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {manifiestoExcelData.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Mostrando primeros 20 de {manifiestoExcelData.length} registros...
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {manifiestoResults.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Resultados
                    </CardTitle>
                    <CardDescription>
                      {manifiestoResults.filter(r => r.status === "success").length} encontrados, {" "}
                      {manifiestoResults.filter(r => r.status === "error").length} errores
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleQueryLogistics} 
                      disabled={isQueryingLogistics || manifiestoResults.filter(r => r.status === "success").length === 0}
                      data-testid="button-query-logistics"
                    >
                      {isQueryingLogistics ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {logisticsProgress.current}/{logisticsProgress.total}
                        </>
                      ) : (
                        <>
                          <Clock className="mr-2 h-4 w-4" /> Consultar Tiempos
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={exportManifiestoResults} data-testid="button-export-manifiestos">
                      <Download className="mr-2 h-4 w-4" /> Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CONSECUTIVOREMESA</TableHead>
                          <TableHead>INGRESOIDMANIFIESTO</TableHead>
                          <TableHead>Fecha Ingreso</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Mensaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manifiestoResults.map((result, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{result.consecutivoRemesa}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {result.ingresoidManifiesto || "-"}
                            </TableCell>
                            <TableCell>{result.fechaIngreso || "-"}</TableCell>
                            <TableCell>
                              {result.status === "success" ? (
                                <span className="text-green-600 font-medium">Encontrado</span>
                              ) : (
                                <span className="text-red-600 font-medium">Error</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.errorMessage || ""}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {logisticsResults.length > 0 && showLogisticsResults && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      Tiempos Logísticos
                    </CardTitle>
                    <CardDescription>
                      {logisticsResults.filter(r => r.status === "success").length} con puntos de control, {" "}
                      {logisticsResults.filter(r => r.status === "error").length} sin datos
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateXmlsFromLogistics} data-testid="button-generate-xmls">
                      <FileCode className="mr-2 h-4 w-4" /> Generar XMLs
                    </Button>
                    <Button variant="outline" onClick={exportLogisticsResults} data-testid="button-export-logistics">
                      <Download className="mr-2 h-4 w-4" /> Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CONSECUTIVO</TableHead>
                          <TableHead>INGRESOID</TableHead>
                          <TableHead>MANIFIESTO</TableHead>
                          <TableHead>PLACA</TableHead>
                          <TableHead>PUNTO</TableHead>
                          <TableHead>MUNICIPIO</TableHead>
                          <TableHead>DIRECCIÓN</TableHead>
                          <TableHead>FECHA CITA</TableHead>
                          <TableHead>HORA CITA</TableHead>
                          <TableHead>LAT</TableHead>
                          <TableHead>LONG</TableHead>
                          <TableHead>TIEMPO PACTADO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logisticsResults.map((result, idx) => (
                          result.controlPoints.length > 0 ? (
                            result.controlPoints.map((cp, cpIdx) => (
                              <TableRow key={`${idx}-${cpIdx}`}>
                                <TableCell className="font-mono">{result.consecutivoRemesa}</TableCell>
                                <TableCell className="font-mono text-primary">{result.ingresoidManifiesto}</TableCell>
                                <TableCell>{result.numManifiestoCarga}</TableCell>
                                <TableCell>{result.numPlaca}</TableCell>
                                <TableCell className="font-medium">{cp.codpuntocontrol}</TableCell>
                                <TableCell>{cp.codmunicipio}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{cp.direccion}</TableCell>
                                <TableCell>{cp.fechacita}</TableCell>
                                <TableCell>{cp.horacita}</TableCell>
                                <TableCell className="font-mono text-xs">{cp.latitud}</TableCell>
                                <TableCell className="font-mono text-xs">{cp.longitud}</TableCell>
                                <TableCell>{cp.tiempopactado}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{result.consecutivoRemesa}</TableCell>
                              <TableCell className="font-mono text-primary">{result.ingresoidManifiesto}</TableCell>
                              <TableCell colSpan={10} className="text-center text-muted-foreground">
                                {result.errorMessage || "Sin puntos de control"}
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {generatedSubmissions.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-purple-500" />
                      XMLs Generados
                    </CardTitle>
                    <CardDescription>
                      {generatedSubmissions.length} XMLs listos para enviar al RNDC
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSendGeneratedBatch} 
                      disabled={isSendingBatch}
                      data-testid="button-send-batch"
                    >
                      {isSendingBatch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Enviar al RNDC
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={exportGeneratedSubmissions} data-testid="button-export-generated">
                      <Download className="mr-2 h-4 w-4" /> Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>INGRESOID</TableHead>
                          <TableHead>PLACA</TableHead>
                          <TableHead>PUNTO</TableHead>
                          <TableHead>LATITUD</TableHead>
                          <TableHead>LONGITUD</TableHead>
                          <TableHead>FECHA LLEGADA</TableHead>
                          <TableHead>HORA LLEGADA</TableHead>
                          <TableHead>FECHA SALIDA</TableHead>
                          <TableHead>HORA SALIDA</TableHead>
                          <TableHead>XML</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedSubmissions.map((sub, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-primary">{sub.ingresoidmanifiesto}</TableCell>
                            <TableCell>{sub.numplaca}</TableCell>
                            <TableCell className="font-medium">{sub.codpuntocontrol}</TableCell>
                            <TableCell className="font-mono text-xs">{sub.latitud}</TableCell>
                            <TableCell className="font-mono text-xs">{sub.longitud}</TableCell>
                            <TableCell>{sub.fechallegada}</TableCell>
                            <TableCell>{sub.horallegada}</TableCell>
                            <TableCell>{sub.fechasalida}</TableCell>
                            <TableCell>{sub.horasalida}</TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedXmlPreview(sub)}
                                data-testid={`button-preview-xml-${idx}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historial">
            <div className="space-y-6">
              {/* Batch History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-purple-500" />
                    Historial de Lotes Enviados
                  </CardTitle>
                  <CardDescription>Lotes de tiempos logísticos enviados al RNDC</CardDescription>
                </CardHeader>
                <CardContent>
                  {batches.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      No hay lotes enviados
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>FECHA</TableHead>
                            <TableHead>TOTAL</TableHead>
                            <TableHead>EXITOSOS</TableHead>
                            <TableHead>ERRORES</TableHead>
                            <TableHead>PENDIENTES</TableHead>
                            <TableHead>ESTADO</TableHead>
                            <TableHead>VER</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((batch) => (
                            <TableRow key={batch.id} data-testid={`batch-row-${batch.id}`}>
                              <TableCell>
                                {format(new Date(batch.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </TableCell>
                              <TableCell className="font-medium">{batch.totalRecords}</TableCell>
                              <TableCell className="text-green-600">{batch.successCount}</TableCell>
                              <TableCell className="text-red-600">{batch.errorCount}</TableCell>
                              <TableCell className="text-yellow-600">{batch.pendingCount}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  batch.status === "completed" ? "bg-green-100 text-green-700" :
                                  batch.status === "processing" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {batch.status === "completed" ? "Completado" : 
                                   batch.status === "processing" ? "Procesando" : batch.status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => viewBatchDetails(batch.id)}
                                  data-testid={`button-view-batch-${batch.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Query History */}
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Consultas</CardTitle>
                  <CardDescription>Últimas consultas realizadas al RNDC</CardDescription>
                </CardHeader>
                <CardContent>
                  {queries.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      No hay consultas registradas
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {queries.map((query) => (
                        <div
                          key={query.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedQuery(query)}
                          data-testid={`query-row-${query.id}`}
                        >
                          <div className="flex items-center gap-4">
                            {query.status === "success" ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium">{query.queryName}</p>
                              <p className="text-sm text-muted-foreground">
                                ID: {query.numIdTercero || "N/A"} | {format(new Date(query.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedQuery} onOpenChange={() => setSelectedQuery(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Consulta - {selectedQuery?.queryName}</DialogTitle>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <p className={selectedQuery.status === "success" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {selectedQuery.status === "success" ? "Exitoso" : "Error"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ID Tercero</Label>
                  <p className="font-mono">{selectedQuery.numIdTercero || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <p>{format(new Date(selectedQuery.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                </div>
              </div>

              {selectedQuery.xmlResponse && (
                <div>
                  <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                    <TableIcon className="h-4 w-4" />
                    Documentos ({getDocumentsFromQuery(selectedQuery).length} registros)
                  </Label>
                  <ScrollArea className="h-[300px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {TERCEROS_COLUMNS.map((col) => (
                            <TableHead key={col.key} className="whitespace-nowrap text-xs">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getDocumentsFromQuery(selectedQuery).map((doc, idx) => (
                          <TableRow key={idx}>
                            {TERCEROS_COLUMNS.map((col) => (
                              <TableCell key={col.key} className="text-xs whitespace-nowrap">
                                {(doc as any)[col.key] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Ver XML Solicitud
                </summary>
                <div className="mt-2">
                  <XmlViewer xml={selectedQuery.xmlRequest} />
                </div>
              </details>

              {selectedQuery.xmlResponse && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Ver XML Respuesta
                  </summary>
                  <div className="mt-2">
                    <XmlViewer xml={selectedQuery.xmlResponse} />
                  </div>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* XML Preview Dialog */}
      <Dialog open={!!selectedXmlPreview} onOpenChange={() => setSelectedXmlPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa XML</DialogTitle>
          </DialogHeader>
          {selectedXmlPreview && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label className="text-muted-foreground">Manifiesto</Label>
                  <p className="font-mono text-primary">{selectedXmlPreview.ingresoidmanifiesto}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Placa</Label>
                  <p className="font-medium">{selectedXmlPreview.numplaca}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Punto Control</Label>
                  <p className="font-medium">{selectedXmlPreview.codpuntocontrol}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ubicación</Label>
                  <p className="font-mono text-xs">{selectedXmlPreview.latitud}, {selectedXmlPreview.longitud}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Llegada</Label>
                  <p>{selectedXmlPreview.fechallegada} {selectedXmlPreview.horallegada}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Salida</Label>
                  <p>{selectedXmlPreview.fechasalida} {selectedXmlPreview.horasalida}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">XML a Enviar</Label>
                <XmlViewer xml={selectedXmlPreview.xmlRequest} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Results Dialog */}
      <Dialog open={showBatchResults} onOpenChange={setShowBatchResults}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Resultados del Lote
              {isPolling && <Loader2 className="h-4 w-4 animate-spin" />}
            </DialogTitle>
          </DialogHeader>
          {currentBatch && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-5">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{currentBatch.totalRecords}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{currentBatch.successCount}</p>
                  <p className="text-xs text-green-600">Exitosos</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{currentBatch.errorCount}</p>
                  <p className="text-xs text-red-600">Errores</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600">{currentBatch.pendingCount}</p>
                  <p className="text-xs text-yellow-600">Pendientes</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-sm font-medium capitalize">{currentBatch.status}</p>
                  <p className="text-xs text-muted-foreground">Estado</p>
                </div>
              </div>

              <ScrollArea className="h-[400px] rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ESTADO</TableHead>
                      <TableHead>INGRESOID</TableHead>
                      <TableHead>PLACA</TableHead>
                      <TableHead>PUNTO</TableHead>
                      <TableHead>LLEGADA</TableHead>
                      <TableHead>SALIDA</TableHead>
                      <TableHead>CÓDIGO</TableHead>
                      <TableHead>MENSAJE</TableHead>
                      <TableHead>VER</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBatchResults.map((sub, idx) => (
                      <TableRow key={idx} className={sub.status === "error" ? "bg-red-50" : sub.status === "success" ? "bg-green-50" : ""}>
                        <TableCell>
                          {sub.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : sub.status === "error" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-primary">{sub.ingresoidmanifiesto}</TableCell>
                        <TableCell>{sub.numplaca}</TableCell>
                        <TableCell className="font-medium">{sub.codpuntocontrol}</TableCell>
                        <TableCell>{sub.fechallegada} {sub.horallegada}</TableCell>
                        <TableCell>{sub.fechasalida} {sub.horasalida}</TableCell>
                        <TableCell className="font-mono">{sub.responseCode || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={sub.responseMessage || ""}>
                          {sub.responseMessage || "-"}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedSubmission(sub)}
                            data-testid={`button-view-submission-${idx}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Submission Details Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Envío</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <p className={selectedSubmission.status === "success" ? "text-green-600 font-medium" : selectedSubmission.status === "error" ? "text-red-600 font-medium" : "text-yellow-600 font-medium"}>
                    {selectedSubmission.status === "success" ? "Exitoso" : selectedSubmission.status === "error" ? "Error" : "Pendiente"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Manifiesto</Label>
                  <p className="font-mono text-primary">{selectedSubmission.ingresoidmanifiesto}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Placa</Label>
                  <p className="font-medium">{selectedSubmission.numplaca}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Punto Control</Label>
                  <p className="font-medium">{selectedSubmission.codpuntocontrol}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Código Respuesta</Label>
                  <p className="font-mono">{selectedSubmission.responseCode || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mensaje Respuesta</Label>
                  <p className={selectedSubmission.status === "error" ? "text-red-600" : ""}>{selectedSubmission.responseMessage || "N/A"}</p>
                </div>
              </div>

              <details className="group" open>
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground font-medium">
                  Ver XML Solicitud
                </summary>
                <div className="mt-2">
                  <XmlViewer xml={selectedSubmission.xmlRequest} />
                </div>
              </details>

              {selectedSubmission.xmlResponse && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground font-medium">
                    Ver XML Respuesta
                  </summary>
                  <div className="mt-2">
                    <XmlViewer xml={selectedSubmission.xmlResponse} />
                  </div>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
