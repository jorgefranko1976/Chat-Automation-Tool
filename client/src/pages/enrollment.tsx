import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Users, Car, Eye, ChevronLeft, ChevronRight, Download, MapPin, Upload, Loader2, UserCheck, MoreHorizontal } from "lucide-react";
import * as XLSX from "xlsx";
import type { Tercero, Vehiculo, RndcConductor } from "@shared/schema";

const TIPOS_TERCERO = [
  { value: "GRANJA", label: "Granja" },
  { value: "PLANTA", label: "Planta" },
  { value: "CONDUCTOR", label: "Conductor" },
  { value: "PROPIETARIO", label: "Propietario" },
];

const TIPOS_IDENTIFICACION = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PA", label: "Pasaporte" },
];

export default function EnrollmentPage() {
  const [activeTab, setActiveTab] = useState("terceros");

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Enrolamiento</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="terceros" className="flex items-center gap-2" data-testid="tab-terceros">
              <Users className="h-4 w-4" />
              Terceros
            </TabsTrigger>
            <TabsTrigger value="conductores" className="flex items-center gap-2" data-testid="tab-conductores">
              <UserCheck className="h-4 w-4" />
              Conductores
            </TabsTrigger>
            <TabsTrigger value="vehiculos" className="flex items-center gap-2" data-testid="tab-vehiculos">
              <Car className="h-4 w-4" />
              Vehículos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terceros" className="mt-6">
            <TercerosSection />
          </TabsContent>

          <TabsContent value="conductores" className="mt-6">
            <ConductoresSection />
          </TabsContent>

          <TabsContent value="vehiculos" className="mt-6">
            <VehiculosSection />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function TercerosSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTercero, setEditingTercero] = useState<Tercero | null>(null);
  const [viewingTercero, setViewingTercero] = useState<Tercero | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: tercerosData, isLoading } = useQuery({
    queryKey: ["/api/terceros", filterTipo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTipo && filterTipo !== "all") params.set("tipo", filterTipo);
      const res = await fetch(`/api/terceros?${params}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/terceros/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
      toast({ title: "Tercero eliminado" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await fetch("/api/terceros/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
      toast({ 
        title: "Importación completada", 
        description: data.message || `${data.results?.created || 0} creados, ${data.results?.updated || 0} actualizados`
      });
    },
    onError: () => {
      toast({ title: "Error al importar", variant: "destructive" });
    },
  });

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        toast({ title: "Error", description: "El archivo está vacío", variant: "destructive" });
        return;
      }

      importMutation.mutate(jsonData);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const terceros: Tercero[] = tercerosData?.terceros || [];
  const filteredTerceros = terceros.filter((t) =>
    searchQuery
      ? t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.numeroIdentificacion.includes(searchQuery)
      : true
  );
  
  const totalPages = Math.ceil(filteredTerceros.length / itemsPerPage);
  const paginatedTerceros = filteredTerceros.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToExcel = () => {
    const data = filteredTerceros.map(t => ({
      Tipo: t.tipoTercero,
      Granja: t.codigoGranja || "",
      Nombre: `${t.nombre} ${t.primerApellido || ""} ${t.segundoApellido || ""}`.trim(),
      Identificacion: `${t.tipoIdentificacion} ${t.numeroIdentificacion}`,
      Flete: t.flete || "",
      Latitud: t.latitud || "",
      Longitud: t.longitud || "",
      Municipio: t.municipio || "",
      Direccion: t.direccion || "",
      Celular: t.celular || "",
      Email: t.email || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terceros");
    XLSX.writeFile(wb, "terceros.xlsx");
    toast({ title: "Excel exportado correctamente" });
  };

  const openMaps = (lat: string, lng: string) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o identificación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-terceros"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-40" data-testid="select-filter-tipo">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {TIPOS_TERCERO.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <label className="cursor-pointer">
            <Button 
              variant="outline" 
              asChild 
              disabled={importMutation.isPending}
              data-testid="button-import-excel"
            >
              <span>
                {importMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Importar Excel</>
                )}
              </span>
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
              disabled={importMutation.isPending}
            />
          </label>
          <Button onClick={() => { setEditingTercero(null); setShowForm(true); }} data-testid="button-add-tercero">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tercero
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Granja</th>
                  <th className="text-left p-3 font-medium">Nombre Sede</th>
                  <th className="text-left p-3 font-medium">Nombre</th>
                  <th className="text-left p-3 font-medium">Flete</th>
                  <th className="text-left p-3 font-medium">Coordenadas</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Cargando...</td></tr>
                ) : paginatedTerceros.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No hay terceros registrados</td></tr>
                ) : (
                  paginatedTerceros.map((tercero) => (
                    <tr key={tercero.id} className="border-t" data-testid={`row-tercero-${tercero.id}`}>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tercero.tipoTercero === "GRANJA" ? "bg-green-100 text-green-700" :
                          tercero.tipoTercero === "PLANTA" ? "bg-blue-100 text-blue-700" :
                          tercero.tipoTercero === "CONDUCTOR" ? "bg-amber-100 text-amber-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {tercero.tipoTercero}
                        </span>
                      </td>
                      <td className="p-3">{tercero.codigoGranja || "-"}</td>
                      <td className="p-3">{tercero.nombreSede || "-"}</td>
                      <td className="p-3">{tercero.nombre} {tercero.primerApellido} {tercero.segundoApellido || ""}</td>
                      <td className="p-3">{tercero.flete ? Math.round(Number(tercero.flete)).toLocaleString() : "-"}</td>
                      <td className="p-3">
                        {tercero.latitud && tercero.longitud ? (
                          <button
                            onClick={() => openMaps(tercero.latitud!, tercero.longitud!)}
                            className="flex items-center gap-1 text-primary hover:underline"
                            data-testid={`button-maps-${tercero.id}`}
                          >
                            <MapPin className="h-3 w-3" />
                            {tercero.latitud}, {tercero.longitud}
                          </button>
                        ) : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingTercero(tercero)}
                            data-testid={`button-view-tercero-${tercero.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingTercero(tercero); setShowForm(true); }}
                            data-testid={`button-edit-tercero-${tercero.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => deleteMutation.mutate(tercero.id)}
                            data-testid={`button-delete-tercero-${tercero.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTerceros.length)} de {filteredTerceros.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {currentPage} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <TerceroFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        tercero={editingTercero}
      />

      <TerceroViewDialog
        open={!!viewingTercero}
        onOpenChange={(open) => !open && setViewingTercero(null)}
        tercero={viewingTercero}
      />
    </div>
  );
}

function TerceroViewDialog({ open, onOpenChange, tercero }: { open: boolean; onOpenChange: (open: boolean) => void; tercero: Tercero | null }) {
  if (!tercero) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Tercero</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium">Tipo:</span> {tercero.tipoTercero}</div>
          <div><span className="font-medium">Identificación:</span> {tercero.tipoIdentificacion} {tercero.numeroIdentificacion}</div>
          <div><span className="font-medium">Nombre:</span> {tercero.nombre} {tercero.primerApellido || ""} {tercero.segundoApellido || ""}</div>
          <div><span className="font-medium">Granja:</span> {tercero.codigoGranja || "-"}</div>
          <div><span className="font-medium">Flete:</span> {tercero.flete || "-"}</div>
          <div><span className="font-medium">Sede:</span> {tercero.sede || "-"}</div>
          <div><span className="font-medium">Nombre Sede:</span> {tercero.nombreSede || "-"}</div>
          <div><span className="font-medium">Municipio:</span> {tercero.municipio || "-"}</div>
          <div><span className="font-medium">Dirección:</span> {tercero.direccion || "-"}</div>
          <div><span className="font-medium">País:</span> {tercero.pais || "-"}</div>
          <div><span className="font-medium">Latitud:</span> {tercero.latitud || "-"}</div>
          <div><span className="font-medium">Longitud:</span> {tercero.longitud || "-"}</div>
          <div><span className="font-medium">Teléfono:</span> {tercero.telefonoFijo || "-"}</div>
          <div><span className="font-medium">Celular:</span> {tercero.celular || "-"}</div>
          <div><span className="font-medium">Email:</span> {tercero.email || "-"}</div>
          <div><span className="font-medium">Régimen Simple:</span> {tercero.regimenSimple || "-"}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TerceroFormDialog({ open, onOpenChange, tercero }: { open: boolean; onOpenChange: (open: boolean) => void; tercero: Tercero | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!tercero;

  const getInitialFormData = () => ({
    tipoTercero: tercero?.tipoTercero || "GRANJA",
    tipoIdentificacion: tercero?.tipoIdentificacion || "CC",
    numeroIdentificacion: tercero?.numeroIdentificacion || "",
    nombre: tercero?.nombre || "",
    primerApellido: tercero?.primerApellido || "",
    segundoApellido: tercero?.segundoApellido || "",
    codigoGranja: tercero?.codigoGranja || "",
    flete: tercero?.flete || "",
    sede: tercero?.sede || "",
    nombreSede: tercero?.nombreSede || "",
    telefonoFijo: tercero?.telefonoFijo || "",
    celular: tercero?.celular || "",
    regimenSimple: tercero?.regimenSimple || "",
    direccion: tercero?.direccion || "",
    pais: tercero?.pais || "COLOMBIA",
    codPais: tercero?.codPais || "169",
    municipio: tercero?.municipio || "",
    latitud: tercero?.latitud || "",
    longitud: tercero?.longitud || "",
    email: tercero?.email || "",
    categoriaLicencia: tercero?.categoriaLicencia || "",
    licencia: tercero?.licencia || "",
    vencimientoLicencia: tercero?.vencimientoLicencia || "",
  });

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, tercero]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEditing ? `/api/terceros/${tercero.id}` : "/api/terceros";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
        toast({ title: isEditing ? "Tercero actualizado" : "Tercero creado" });
        onOpenChange(false);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold bg-primary text-primary-foreground -m-6 mb-4 p-4 rounded-t-lg">
            {isEditing ? "Editar Tercero" : "Nuevo Tercero"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-4 gap-4 items-center">
            <Label>Tipo de Tercero *</Label>
            <Select value={formData.tipoTercero} onValueChange={(v) => updateField("tipoTercero", v)}>
              <SelectTrigger className="col-span-3" data-testid="select-tipo-tercero">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TERCERO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            Datos generales del Tercero
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo Identificación *</Label>
              <Select value={formData.tipoIdentificacion} onValueChange={(v) => updateField("tipoIdentificacion", v)}>
                <SelectTrigger data-testid="select-tipo-identificacion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_IDENTIFICACION.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número Identificación *</Label>
              <Input
                value={formData.numeroIdentificacion}
                onChange={(e) => updateField("numeroIdentificacion", e.target.value)}
                required
                data-testid="input-numero-identificacion"
              />
            </div>
            <div className="space-y-2">
              <Label>{formData.tipoIdentificacion === "NIT" ? "Razón Social *" : "Nombre *"}</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                required
                data-testid="input-nombre"
              />
            </div>
            {formData.tipoIdentificacion !== "NIT" && (
              <>
                <div className="space-y-2">
                  <Label>Primer Apellido *</Label>
                  <Input
                    value={formData.primerApellido}
                    onChange={(e) => updateField("primerApellido", e.target.value)}
                    required
                    data-testid="input-primer-apellido"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Segundo Apellido</Label>
                  <Input
                    value={formData.segundoApellido}
                    onChange={(e) => updateField("segundoApellido", e.target.value)}
                    data-testid="input-segundo-apellido"
                  />
                </div>
              </>
            )}
            {formData.tipoTercero === "GRANJA" && (
              <>
                <div className="space-y-2">
                  <Label>Granja</Label>
                  <Input
                    value={formData.codigoGranja}
                    onChange={(e) => updateField("codigoGranja", e.target.value)}
                    placeholder="Código de granja"
                    data-testid="input-codigo-granja"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flete</Label>
                  <Input
                    value={formData.flete}
                    onChange={(e) => updateField("flete", e.target.value)}
                    data-testid="input-flete"
                  />
                </div>
              </>
            )}
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            Datos obligatorios de ubicación
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sede</Label>
              <Input
                value={formData.sede}
                onChange={(e) => updateField("sede", e.target.value)}
                data-testid="input-sede"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre Sede</Label>
              <Input
                value={formData.nombreSede}
                onChange={(e) => updateField("nombreSede", e.target.value)}
                data-testid="input-nombre-sede"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono Fijo</Label>
              <Input
                value={formData.telefonoFijo}
                onChange={(e) => updateField("telefonoFijo", e.target.value)}
                data-testid="input-telefono-fijo"
              />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input
                value={formData.celular}
                onChange={(e) => updateField("celular", e.target.value)}
                data-testid="input-celular"
              />
            </div>
            <div className="space-y-2">
              <Label>Régimen Simple (S/N)</Label>
              <Input
                value={formData.regimenSimple}
                onChange={(e) => updateField("regimenSimple", e.target.value)}
                maxLength={1}
                data-testid="input-regimen-simple"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Dirección</Label>
              <Input
                value={formData.direccion}
                onChange={(e) => updateField("direccion", e.target.value)}
                data-testid="input-direccion"
              />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={formData.pais}
                onChange={(e) => updateField("pais", e.target.value)}
                data-testid="input-pais"
              />
            </div>
            <div className="space-y-2">
              <Label>Código País</Label>
              <Input
                value={formData.codPais}
                onChange={(e) => updateField("codPais", e.target.value)}
                data-testid="input-cod-pais"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Municipio</Label>
              <Input
                value={formData.municipio}
                onChange={(e) => updateField("municipio", e.target.value)}
                data-testid="input-municipio"
              />
            </div>
            <div className="space-y-2">
              <Label>Latitud Ubicación Sede</Label>
              <Input
                value={formData.latitud}
                onChange={(e) => updateField("latitud", e.target.value)}
                data-testid="input-latitud"
              />
            </div>
            <div className="space-y-2">
              <Label>Longitud Ubicación Sede</Label>
              <Input
                value={formData.longitud}
                onChange={(e) => updateField("longitud", e.target.value)}
                data-testid="input-longitud"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>e-Mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                data-testid="input-email"
              />
            </div>
          </div>

          {formData.tipoTercero === "CONDUCTOR" && (
            <>
              <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
                Datos Obligatorios para Conductor
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Categoría Licencia</Label>
                  <Input
                    value={formData.categoriaLicencia}
                    onChange={(e) => updateField("categoriaLicencia", e.target.value)}
                    data-testid="input-categoria-licencia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Licencia</Label>
                  <Input
                    value={formData.licencia}
                    onChange={(e) => updateField("licencia", e.target.value)}
                    data-testid="input-licencia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vencimiento</Label>
                  <Input
                    type="date"
                    value={formData.vencimientoLicencia}
                    onChange={(e) => updateField("vencimientoLicencia", e.target.value)}
                    data-testid="input-vencimiento-licencia"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-tercero">
              {mutation.isPending ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConductoresSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [viewingConductor, setViewingConductor] = useState<RndcConductor | null>(null);
  const [editingConductor, setEditingConductor] = useState<RndcConductor | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", telefono: "", categoriaLicencia: "", venceLicencia: "", placa: "" });
  const itemsPerPage = 15;

  const { data: conductoresData, isLoading } = useQuery({
    queryKey: ["/api/conductores"],
    queryFn: async () => {
      const res = await fetch("/api/conductores");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conductores/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conductores"] });
      toast({ title: "Conductor eliminado" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await fetch("/api/conductores/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conductores"] });
      toast({
        title: "Importación completada",
        description: data.message || `${data.results?.created || 0} creados, ${data.results?.updated || 0} actualizados`,
      });
      setIsImporting(false);
    },
    onError: () => {
      toast({ title: "Error al importar", variant: "destructive" });
      setIsImporting(false);
    },
  });

  const convertDateToISO = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return dateStr;
  };

  const convertDateToDMY = (isoDate: string): string => {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editForm }) => {
      const payload = {
        ...data,
        venceLicencia: convertDateToDMY(data.venceLicencia),
      };
      const res = await fetch(`/api/conductores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conductores"] });
      toast({ title: "Conductor actualizado" });
      setEditingConductor(null);
    },
    onError: () => {
      toast({ title: "Error al actualizar", variant: "destructive" });
    },
  });

  const openEdit = (conductor: RndcConductor) => {
    setEditForm({
      nombre: conductor.nombre || "",
      telefono: conductor.telefono || "",
      categoriaLicencia: conductor.categoriaLicencia || "",
      venceLicencia: convertDateToISO(conductor.venceLicencia || ""),
      placa: conductor.placa || "",
    });
    setEditingConductor(conductor);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      importMutation.mutate(jsonData);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const conductores: RndcConductor[] = conductoresData?.conductores || [];
  const filteredConductores = conductores.filter((c) =>
    searchQuery
      ? c.cedula.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.nombre?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const totalPages = Math.ceil(filteredConductores.length / itemsPerPage);
  const paginatedConductores = filteredConductores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Conductores ({filteredConductores.length})
          </CardTitle>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cédula o nombre..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 w-64"
              data-testid="input-search-conductores"
            />
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            className="hidden"
            id="import-conductores-excel"
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("import-conductores-excel")?.click()}
            disabled={isImporting}
            data-testid="button-import-conductores"
          >
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Cédula</th>
                    <th className="text-left p-3 font-medium">Nombre</th>
                    <th className="text-left p-3 font-medium">Vence Licencia</th>
                    <th className="text-left p-3 font-medium">Categoría</th>
                    <th className="text-left p-3 font-medium">Teléfono</th>
                    <th className="text-left p-3 font-medium">Placa</th>
                    <th className="text-left p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedConductores.map((conductor) => (
                    <tr key={conductor.id} className="border-t hover:bg-muted/30" data-testid={`row-conductor-${conductor.id}`}>
                      <td className="p-3 font-mono">{conductor.cedula}</td>
                      <td className="p-3">{conductor.nombre || "-"}</td>
                      <td className="p-3">{conductor.venceLicencia || "-"}</td>
                      <td className="p-3">{conductor.categoriaLicencia || "-"}</td>
                      <td className="p-3">{conductor.telefono || "-"}</td>
                      <td className="p-3 font-mono">{conductor.placa || "-"}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-conductor-${conductor.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingConductor(conductor)} data-testid={`menu-view-conductor-${conductor.id}`}>
                              <Eye className="h-4 w-4 mr-2" /> Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(conductor)} data-testid={`menu-edit-conductor-${conductor.id}`}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(conductor.id)} className="text-destructive" data-testid={`menu-delete-conductor-${conductor.id}`}>
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {paginatedConductores.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No hay conductores registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredConductores.length)} de {filteredConductores.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!viewingConductor} onOpenChange={() => setViewingConductor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del Conductor</DialogTitle>
            <DialogDescription>Información registrada del conductor</DialogDescription>
          </DialogHeader>
          {viewingConductor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Cédula</Label>
                  <p className="font-mono">{viewingConductor.cedula}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nombre</Label>
                  <p>{viewingConductor.nombre || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Categoría Licencia</Label>
                  <p>{viewingConductor.categoriaLicencia || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vence Licencia</Label>
                  <p>{viewingConductor.venceLicencia || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Teléfono</Label>
                  <p>{viewingConductor.telefono || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Placa</Label>
                  <p className="font-mono">{viewingConductor.placa || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ingreso ID</Label>
                  <p className="font-mono text-xs">{viewingConductor.ingresoId || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Última Sincronización</Label>
                  <p className="text-xs">{viewingConductor.lastSyncedAt ? new Date(viewingConductor.lastSyncedAt).toLocaleString() : "-"}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingConductor(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingConductor} onOpenChange={() => setEditingConductor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Conductor</DialogTitle>
            <DialogDescription>Modifique los datos del conductor {editingConductor?.cedula}</DialogDescription>
          </DialogHeader>
          {editingConductor && (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editingConductor.id, data: editForm }); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nombre</Label>
                  <Input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} data-testid="input-edit-nombre" />
                </div>
                <div>
                  <Label>Categoría Licencia</Label>
                  <Input value={editForm.categoriaLicencia} onChange={(e) => setEditForm({ ...editForm, categoriaLicencia: e.target.value })} placeholder="C1, C2, C3..." data-testid="input-edit-categoria" />
                </div>
                <div>
                  <Label>Vence Licencia</Label>
                  <Input type="date" value={editForm.venceLicencia} onChange={(e) => setEditForm({ ...editForm, venceLicencia: e.target.value })} data-testid="input-edit-vence" />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} data-testid="input-edit-telefono" />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input value={editForm.placa} onChange={(e) => setEditForm({ ...editForm, placa: e.target.value.toUpperCase() })} placeholder="ABC123" data-testid="input-edit-placa" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingConductor(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-conductor">
                  {updateMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function VehiculosSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);
  const [viewingVehiculo, setViewingVehiculo] = useState<Vehiculo | null>(null);

  const { data: vehiculosData, isLoading } = useQuery({
    queryKey: ["/api/vehiculos"],
    queryFn: async () => {
      const res = await fetch("/api/vehiculos");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vehiculos/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehiculos"] });
      toast({ title: "Vehículo eliminado" });
    },
  });

  const vehiculos: Vehiculo[] = vehiculosData?.vehiculos || [];
  const filteredVehiculos = vehiculos.filter((v) =>
    searchQuery
      ? v.placa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.propietarioNombre?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa o propietario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-vehiculos"
          />
        </div>
        <Button onClick={() => { setEditingVehiculo(null); setShowForm(true); }} data-testid="button-add-vehiculo">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Vehículo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Placa</th>
                  <th className="text-left p-3 font-medium">Tipo ID</th>
                  <th className="text-left p-3 font-medium">Propietario</th>
                  <th className="text-left p-3 font-medium">Toneladas</th>
                  <th className="text-left p-3 font-medium">Vence SOAT</th>
                  <th className="text-left p-3 font-medium">Vence Licencia</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Cargando...</td></tr>
                ) : filteredVehiculos.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No hay vehículos registrados</td></tr>
                ) : (
                  filteredVehiculos.map((vehiculo) => (
                    <tr key={vehiculo.id} className="border-t" data-testid={`row-vehiculo-${vehiculo.id}`}>
                      <td className="p-3 font-mono font-medium">{vehiculo.placa}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          vehiculo.propietarioTipoId === "NIT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {vehiculo.propietarioTipoId || "CC"}
                        </span>
                      </td>
                      <td className="p-3">{vehiculo.propietarioNombre || "-"}</td>
                      <td className="p-3">{vehiculo.toneladas || "-"}</td>
                      <td className="p-3">{vehiculo.venceSoat || "-"}</td>
                      <td className="p-3">{vehiculo.venceLicenciaConduccion || "-"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingVehiculo(vehiculo)}
                            data-testid={`button-view-vehiculo-${vehiculo.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingVehiculo(vehiculo); setShowForm(true); }}
                            data-testid={`button-edit-vehiculo-${vehiculo.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => deleteMutation.mutate(vehiculo.id)}
                            data-testid={`button-delete-vehiculo-${vehiculo.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <VehiculoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        vehiculo={editingVehiculo}
      />

      <VehiculoViewDialog
        open={!!viewingVehiculo}
        onOpenChange={(open) => !open && setViewingVehiculo(null)}
        vehiculo={viewingVehiculo}
      />
    </div>
  );
}

function VehiculoViewDialog({ open, onOpenChange, vehiculo }: { open: boolean; onOpenChange: (open: boolean) => void; vehiculo: Vehiculo | null }) {
  if (!vehiculo) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Vehículo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium">Placa:</span> {vehiculo.placa}</div>
          <div><span className="font-medium">Toneladas:</span> {vehiculo.toneladas || "-"}</div>
          <div><span className="font-medium">Tipo ID Propietario:</span> {vehiculo.propietarioTipoId || "CC"}</div>
          <div><span className="font-medium">Número ID Propietario:</span> {vehiculo.propietarioNumeroId || "-"}</div>
          <div><span className="font-medium">Nombre Propietario:</span> {vehiculo.propietarioNombre || "-"}</div>
          <div><span className="font-medium">Teléfono Propietario:</span> {vehiculo.propietarioTelefono || "-"}</div>
          <div><span className="font-medium">Dirección Propietario:</span> {vehiculo.propietarioDireccion || "-"}</div>
          <div><span className="font-medium">CC Conductor:</span> {vehiculo.conductorCc || "-"}</div>
          <div><span className="font-medium">Nombre Conductor:</span> {vehiculo.conductorNombre || "-"}</div>
          <div><span className="font-medium">Dirección Conductor:</span> {vehiculo.conductorDireccion || "-"}</div>
          <div><span className="font-medium">Teléfono Conductor:</span> {vehiculo.conductorTelefono || "-"}</div>
          <div><span className="font-medium">Vence SOAT:</span> {vehiculo.venceSoat || "-"}</div>
          <div><span className="font-medium">Vence Licencia:</span> {vehiculo.venceLicenciaConduccion || "-"}</div>
          <div><span className="font-medium">Vence Tecnomecánica:</span> {vehiculo.venceTecnicomecanica || "-"}</div>
          <div><span className="font-medium">Comparendos:</span> {vehiculo.comparendos || "-"}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehiculoFormDialog({ open, onOpenChange, vehiculo }: { open: boolean; onOpenChange: (open: boolean) => void; vehiculo: Vehiculo | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!vehiculo;

  const getInitialFormData = () => ({
    placa: vehiculo?.placa || "",
    propietarioTipoId: vehiculo?.propietarioTipoId || "CC",
    propietarioNumeroId: vehiculo?.propietarioNumeroId || "",
    propietarioNombre: vehiculo?.propietarioNombre || "",
    propietarioDireccion: vehiculo?.propietarioDireccion || "",
    propietarioTelefono: vehiculo?.propietarioTelefono || "",
    conductorCc: vehiculo?.conductorCc || "",
    conductorNombre: vehiculo?.conductorNombre || "",
    conductorDireccion: vehiculo?.conductorDireccion || "",
    conductorTelefono: vehiculo?.conductorTelefono || "",
    venceSoat: vehiculo?.venceSoat || "",
    venceLicenciaConduccion: vehiculo?.venceLicenciaConduccion || "",
    venceTecnicomecanica: vehiculo?.venceTecnicomecanica || "",
    toneladas: vehiculo?.toneladas || "",
    comparendos: vehiculo?.comparendos || "",
  });

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, vehiculo]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEditing ? `/api/vehiculos/${vehiculo.id}` : "/api/vehiculos";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/vehiculos"] });
        toast({ title: isEditing ? "Vehículo actualizado" : "Vehículo creado" });
        onOpenChange(false);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold bg-primary text-primary-foreground -m-6 mb-4 p-4 rounded-t-lg">
            {isEditing ? "Editar Vehículo" : "Nuevo Vehículo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input
                value={formData.placa}
                onChange={(e) => updateField("placa", e.target.value.toUpperCase())}
                required
                maxLength={6}
                className="uppercase"
                data-testid="input-placa"
              />
            </div>
            <div className="space-y-2">
              <Label>Toneladas</Label>
              <Input
                value={formData.toneladas}
                onChange={(e) => updateField("toneladas", e.target.value)}
                data-testid="input-toneladas"
              />
            </div>
            <div className="space-y-2">
              <Label>Comparendos</Label>
              <Input
                value={formData.comparendos}
                onChange={(e) => updateField("comparendos", e.target.value)}
                data-testid="input-comparendos"
              />
            </div>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            INFORMACIÓN DEL PROPIETARIO
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo Identificación</Label>
              <Select value={formData.propietarioTipoId} onValueChange={(v) => updateField("propietarioTipoId", v)}>
                <SelectTrigger data-testid="select-propietario-tipo-id">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número Identificación</Label>
              <Input
                value={formData.propietarioNumeroId}
                onChange={(e) => updateField("propietarioNumeroId", e.target.value)}
                data-testid="input-propietario-numero-id"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre Propietario</Label>
              <Input
                value={formData.propietarioNombre}
                onChange={(e) => updateField("propietarioNombre", e.target.value)}
                data-testid="input-propietario-nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono Propietario</Label>
              <Input
                value={formData.propietarioTelefono}
                onChange={(e) => updateField("propietarioTelefono", e.target.value)}
                data-testid="input-propietario-telefono"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Dirección Propietario</Label>
              <Input
                value={formData.propietarioDireccion}
                onChange={(e) => updateField("propietarioDireccion", e.target.value)}
                data-testid="input-propietario-direccion"
              />
            </div>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            INFORMACIÓN DEL CONDUCTOR
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CC Conductor</Label>
              <Input
                value={formData.conductorCc}
                onChange={(e) => updateField("conductorCc", e.target.value)}
                data-testid="input-conductor-cc"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre Conductor</Label>
              <Input
                value={formData.conductorNombre}
                onChange={(e) => updateField("conductorNombre", e.target.value)}
                data-testid="input-conductor-nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección Conductor</Label>
              <Input
                value={formData.conductorDireccion}
                onChange={(e) => updateField("conductorDireccion", e.target.value)}
                data-testid="input-conductor-direccion"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono Conductor</Label>
              <Input
                value={formData.conductorTelefono}
                onChange={(e) => updateField("conductorTelefono", e.target.value)}
                data-testid="input-conductor-telefono"
              />
            </div>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            FECHAS DE VENCIMIENTO
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Vence SOAT</Label>
              <Input
                type="date"
                value={formData.venceSoat}
                onChange={(e) => updateField("venceSoat", e.target.value)}
                data-testid="input-vence-soat"
              />
            </div>
            <div className="space-y-2">
              <Label>Vence Licencia Conducción</Label>
              <Input
                type="date"
                value={formData.venceLicenciaConduccion}
                onChange={(e) => updateField("venceLicenciaConduccion", e.target.value)}
                data-testid="input-vence-licencia"
              />
            </div>
            <div className="space-y-2">
              <Label>Vence Tecnomecánica</Label>
              <Input
                type="date"
                value={formData.venceTecnicomecanica}
                onChange={(e) => updateField("venceTecnicomecanica", e.target.value)}
                data-testid="input-vence-tecnomecanica"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-vehiculo">
              {mutation.isPending ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
