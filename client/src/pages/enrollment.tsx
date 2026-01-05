import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Users, Car, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import type { Tercero, Vehiculo } from "@shared/schema";

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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="terceros" className="flex items-center gap-2" data-testid="tab-terceros">
              <Users className="h-4 w-4" />
              Terceros
            </TabsTrigger>
            <TabsTrigger value="vehiculos" className="flex items-center gap-2" data-testid="tab-vehiculos">
              <Car className="h-4 w-4" />
              Vehículos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terceros" className="mt-6">
            <TercerosSection />
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
        <Button onClick={() => { setEditingTercero(null); setShowForm(true); }} data-testid="button-add-tercero">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tercero
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Granja</th>
                  <th className="text-left p-3 font-medium">Nombre</th>
                  <th className="text-left p-3 font-medium">Flete</th>
                  <th className="text-left p-3 font-medium">Coordenadas</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Cargando...</td></tr>
                ) : paginatedTerceros.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No hay terceros registrados</td></tr>
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
                      <td className="p-3">{tercero.nombre} {tercero.primerApellido} {tercero.segundoApellido || ""}</td>
                      <td className="p-3">{tercero.flete || "-"}</td>
                      <td className="p-3">{tercero.latitud && tercero.longitud ? `${tercero.latitud}, ${tercero.longitud}` : "-"}</td>
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

function VehiculosSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);

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
                  <th className="text-left p-3 font-medium">Marca</th>
                  <th className="text-left p-3 font-medium">Modelo</th>
                  <th className="text-left p-3 font-medium">Clase</th>
                  <th className="text-left p-3 font-medium">Propietario</th>
                  <th className="text-left p-3 font-medium">Vence SOAT</th>
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
                      <td className="p-3">{vehiculo.marca || "-"}</td>
                      <td className="p-3">{vehiculo.modelo || "-"}</td>
                      <td className="p-3">{vehiculo.clase || "-"}</td>
                      <td className="p-3">{vehiculo.propietarioNombre || "-"}</td>
                      <td className="p-3">{vehiculo.venceSoat || "-"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
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
    </div>
  );
}

function VehiculoFormDialog({ open, onOpenChange, vehiculo }: { open: boolean; onOpenChange: (open: boolean) => void; vehiculo: Vehiculo | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!vehiculo;

  const getInitialFormData = () => ({
    placa: vehiculo?.placa || "",
    configuracion: vehiculo?.configuracion || "",
    marca: vehiculo?.marca || "",
    clase: vehiculo?.clase || "",
    carroceria: vehiculo?.carroceria || "",
    servicio: vehiculo?.servicio || "",
    tipoCombustible: vehiculo?.tipoCombustible || "",
    numeroEjes: vehiculo?.numeroEjes || "",
    fechaMatricula: vehiculo?.fechaMatricula || "",
    modelo: vehiculo?.modelo || "",
    modalidad: vehiculo?.modalidad || "",
    pbv: vehiculo?.pbv || "",
    pesoVacio: vehiculo?.pesoVacio || "",
    numeroPoliza: vehiculo?.numeroPoliza || "",
    aseguradora: vehiculo?.aseguradora || "",
    nitAseguradora: vehiculo?.nitAseguradora || "",
    venceSoat: vehiculo?.venceSoat || "",
    venceRevisionTecnomecanica: vehiculo?.venceRevisionTecnomecanica || "",
    propietarioTipoId: vehiculo?.propietarioTipoId || "",
    propietarioNumeroId: vehiculo?.propietarioNumeroId || "",
    propietarioNombre: vehiculo?.propietarioNombre || "",
    tenedorTipoId: vehiculo?.tenedorTipoId || "",
    tenedorNumeroId: vehiculo?.tenedorNumeroId || "",
    tenedorNombre: vehiculo?.tenedorNombre || "",
    fechaVinculacionInicial: vehiculo?.fechaVinculacionInicial || "",
    fechaVinculacionFinal: vehiculo?.fechaVinculacionFinal || "",
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold bg-primary text-primary-foreground -m-6 mb-4 p-4 rounded-t-lg">
            {isEditing ? "Editar Vehículo" : "Nuevo Vehículo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            CARACTERÍSTICAS GENERALES DEL VEHÍCULO
          </div>

          <div className="grid grid-cols-4 gap-4">
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
            <div className="space-y-2 col-span-2">
              <Label>Configuración</Label>
              <Input
                value={formData.configuracion}
                onChange={(e) => updateField("configuracion", e.target.value)}
                data-testid="input-configuracion"
              />
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              <Input
                value={formData.marca}
                onChange={(e) => updateField("marca", e.target.value)}
                data-testid="input-marca"
              />
            </div>
            <div className="space-y-2">
              <Label>Clase</Label>
              <Input
                value={formData.clase}
                onChange={(e) => updateField("clase", e.target.value)}
                data-testid="input-clase"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Carrocería</Label>
              <Input
                value={formData.carroceria}
                onChange={(e) => updateField("carroceria", e.target.value)}
                data-testid="input-carroceria"
              />
            </div>
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Input
                value={formData.servicio}
                onChange={(e) => updateField("servicio", e.target.value)}
                data-testid="input-servicio"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo Combustible</Label>
              <Input
                value={formData.tipoCombustible}
                onChange={(e) => updateField("tipoCombustible", e.target.value)}
                data-testid="input-tipo-combustible"
              />
            </div>
            <div className="space-y-2">
              <Label>Número Ejes</Label>
              <Input
                value={formData.numeroEjes}
                onChange={(e) => updateField("numeroEjes", e.target.value)}
                data-testid="input-numero-ejes"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Matrícula</Label>
              <Input
                type="date"
                value={formData.fechaMatricula}
                onChange={(e) => updateField("fechaMatricula", e.target.value)}
                data-testid="input-fecha-matricula"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={formData.modelo}
                onChange={(e) => updateField("modelo", e.target.value)}
                data-testid="input-modelo"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Modalidad</Label>
              <Input
                value={formData.modalidad}
                onChange={(e) => updateField("modalidad", e.target.value)}
                data-testid="input-modalidad"
              />
            </div>
            <div className="space-y-2">
              <Label>PBV (Kilos)</Label>
              <Input
                value={formData.pbv}
                onChange={(e) => updateField("pbv", e.target.value)}
                data-testid="input-pbv"
              />
            </div>
            <div className="space-y-2">
              <Label>Peso Vacío (Kilos)</Label>
              <Input
                value={formData.pesoVacio}
                onChange={(e) => updateField("pesoVacio", e.target.value)}
                data-testid="input-peso-vacio"
              />
            </div>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            INFORMACIÓN DEL SOAT Y REVISIÓN TECNOMECÁNICA
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Número Póliza</Label>
              <Input
                value={formData.numeroPoliza}
                onChange={(e) => updateField("numeroPoliza", e.target.value)}
                data-testid="input-numero-poliza"
              />
            </div>
            <div className="space-y-2">
              <Label>Aseguradora</Label>
              <Input
                value={formData.aseguradora}
                onChange={(e) => updateField("aseguradora", e.target.value)}
                data-testid="input-aseguradora"
              />
            </div>
            <div className="space-y-2">
              <Label>NIT Aseguradora</Label>
              <Input
                value={formData.nitAseguradora}
                onChange={(e) => updateField("nitAseguradora", e.target.value)}
                data-testid="input-nit-aseguradora"
              />
            </div>
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
              <Label>Vence Revisión TecnMeca</Label>
              <Input
                type="date"
                value={formData.venceRevisionTecnomecanica}
                onChange={(e) => updateField("venceRevisionTecnomecanica", e.target.value)}
                data-testid="input-vence-revision"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium mb-4">
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
                      {TIPOS_IDENTIFICACION.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
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
                <div className="space-y-2 col-span-2">
                  <Label>Nombre</Label>
                  <Input
                    value={formData.propietarioNombre}
                    onChange={(e) => updateField("propietarioNombre", e.target.value)}
                    data-testid="input-propietario-nombre"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium mb-4">
                INFORMACIÓN DEL TENEDOR O LOCATARIO
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Identificación</Label>
                  <Select value={formData.tenedorTipoId} onValueChange={(v) => updateField("tenedorTipoId", v)}>
                    <SelectTrigger data-testid="select-tenedor-tipo-id">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_IDENTIFICACION.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número Identificación</Label>
                  <Input
                    value={formData.tenedorNumeroId}
                    onChange={(e) => updateField("tenedorNumeroId", e.target.value)}
                    data-testid="input-tenedor-numero-id"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Nombre</Label>
                  <Input
                    value={formData.tenedorNombre}
                    onChange={(e) => updateField("tenedorNombre", e.target.value)}
                    data-testid="input-tenedor-nombre"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary text-primary-foreground px-4 py-2 -mx-6 font-medium">
            AÑADIR VINCULACIÓN DE VEHÍCULOS
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicial</Label>
              <Input
                type="date"
                value={formData.fechaVinculacionInicial}
                onChange={(e) => updateField("fechaVinculacionInicial", e.target.value)}
                data-testid="input-fecha-vinculacion-inicial"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Final</Label>
              <Input
                type="date"
                value={formData.fechaVinculacionFinal}
                onChange={(e) => updateField("fechaVinculacionFinal", e.target.value)}
                data-testid="input-fecha-vinculacion-final"
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
