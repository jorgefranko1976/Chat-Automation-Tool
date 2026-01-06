import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, RndcSettings, WsEnvironment } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { Save, KeyRound, Building2, Globe, CheckCircle2, RotateCcw, Server, User, Lock, Loader2, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function Settings() {
  const { settings, saveSettings } = useSettings();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<RndcSettings>(settings);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    username: user?.username || "",
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        username: user.username || "",
      });
    }
  }, [user]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const result = await updateProfile(profileData);
    setIsSavingProfile(false);

    if (result.success) {
      toast({
        title: "Perfil Actualizado",
        description: "Sus datos han sido guardados correctamente.",
      });
    } else {
      toast({
        title: "Error",
        description: result.message || "No se pudo actualizar el perfil.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La nueva contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);
    setIsChangingPassword(false);

    if (result.success) {
      toast({
        title: "Contraseña Actualizada",
        description: "Su contraseña ha sido cambiada correctamente.",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast({
        title: "Error",
        description: result.message || "No se pudo cambiar la contraseña.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleRestart = async () => {
    if (!confirm("¿Está seguro que desea reiniciar el servidor? La aplicación estará temporalmente no disponible.")) {
      return;
    }
    
    setIsRestarting(true);
    try {
      await apiRequest("POST", "/api/system/restart");
      toast({
        title: "Reiniciando Servidor",
        description: "El servidor se reiniciará en unos segundos. Recargue la página después de un momento.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo reiniciar el servidor.",
        variant: "destructive",
      });
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof RndcSettings, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnvironmentChange = (env: WsEnvironment) => {
    setFormData(prev => ({ ...prev, wsEnvironment: env }));
  };

  const handleSave = () => {
    saveSettings(formData);
    toast({
      title: "Configuración Guardada",
      description: "Los parámetros del sistema han sido actualizados correctamente.",
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">Configure los parámetros del sistema</p>
        </div>

        <Tabs defaultValue="user" className="w-full max-w-3xl">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="user" data-testid="tab-user">
              <User className="mr-2 h-4 w-4" /> Usuario
            </TabsTrigger>
            <TabsTrigger value="credentials" data-testid="tab-credentials">
              <KeyRound className="mr-2 h-4 w-4" /> Credenciales
            </TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">
              <Building2 className="mr-2 h-4 w-4" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="webservice" data-testid="tab-webservice">
              <Globe className="mr-2 h-4 w-4" /> Web Service
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <Server className="mr-2 h-4 w-4" /> Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>Perfil de Usuario</CardTitle>
                <CardDescription>Actualice su información personal y gestione su cuenta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> Información Personal
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Nombre</Label>
                      <Input 
                        id="profile-name"
                        value={profileData.name} 
                        onChange={(e) => handleProfileChange("name", e.target.value)}
                        placeholder="Su nombre completo"
                        data-testid="input-profile-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Correo Electrónico</Label>
                      <Input 
                        id="profile-email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                        placeholder="correo@ejemplo.com"
                        data-testid="input-profile-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-username">Nombre de Usuario</Label>
                    <Input 
                      id="profile-username"
                      value={profileData.username}
                      onChange={(e) => handleProfileChange("username", e.target.value)}
                      placeholder="Usuario para iniciar sesión"
                      data-testid="input-profile-username"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveProfile} 
                    className="w-full sm:w-auto" 
                    disabled={isSavingProfile}
                    data-testid="button-save-profile"
                  >
                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Perfil
                  </Button>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Cambiar Contraseña
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Contraseña Actual</Label>
                      <Input 
                        id="current-password"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                        placeholder="Ingrese su contraseña actual"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Nueva Contraseña</Label>
                        <Input 
                          id="new-password"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          data-testid="input-new-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                        <Input 
                          id="confirm-password"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                          placeholder="Repita la nueva contraseña"
                          data-testid="input-confirm-password"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleChangePassword} 
                      variant="secondary"
                      className="w-full sm:w-auto" 
                      disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword}
                      data-testid="button-change-password"
                    >
                      {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                      Cambiar Contraseña
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Sesión</h4>
                  <Button 
                    onClick={handleLogout} 
                    variant="destructive"
                    className="w-full sm:w-auto"
                    data-testid="button-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials">
            <Card>
              <CardHeader>
                <CardTitle>Credenciales RNDC</CardTitle>
                <CardDescription>Datos de acceso para el WebService del Ministerio de Transporte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Credenciales GPS (Tiempos)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="usernameGps">Usuario GPS</Label>
                      <Input 
                        id="usernameGps"
                        value={formData.usernameGps} 
                        onChange={(e) => handleChange("usernameGps", e.target.value)}
                        placeholder="Ej: TIEMPOS@0739"
                        data-testid="input-username-gps"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordGps">Contraseña GPS</Label>
                      <Input 
                        id="passwordGps"
                        type="password" 
                        value={formData.passwordGps}
                        onChange={(e) => handleChange("passwordGps", e.target.value)}
                        placeholder="Contraseña GPS"
                        data-testid="input-password-gps"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Credenciales RNDC (Cumplidos)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="usernameRndc">Usuario RNDC</Label>
                      <Input 
                        id="usernameRndc"
                        value={formData.usernameRndc} 
                        onChange={(e) => handleChange("usernameRndc", e.target.value)}
                        placeholder="Ej: TRANSPORTES@739"
                        data-testid="input-username-rndc"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordRndc">Contraseña RNDC</Label>
                      <Input 
                        id="passwordRndc"
                        type="password" 
                        value={formData.passwordRndc}
                        onChange={(e) => handleChange("passwordRndc", e.target.value)}
                        placeholder="Contraseña RNDC"
                        data-testid="input-password-rndc"
                      />
                    </div>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-credentials">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Empresa</CardTitle>
                <CardDescription>Información de su empresa para los reportes RNDC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la Empresa</Label>
                  <Input 
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                    placeholder="Razón social de la empresa"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyNit">NIT Empresa</Label>
                  <Input 
                    id="companyNit"
                    value={formData.companyNit}
                    onChange={(e) => handleChange("companyNit", e.target.value)}
                    placeholder="NIT sin dígito de verificación"
                    data-testid="input-company-nit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consecutivo">Consecutivo Remesas/Manifiestos</Label>
                  <Input 
                    id="consecutivo"
                    type="number"
                    min="1"
                    value={formData.consecutivo}
                    onChange={(e) => handleChange("consecutivo", parseInt(e.target.value) || 1)}
                    placeholder="Número desde donde inicia el consecutivo"
                    data-testid="input-consecutivo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número consecutivo para generar remesas y manifiestos. Se incrementará automáticamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numIdGps">ID GPS (NUMIDGPS)</Label>
                  <Input 
                    id="numIdGps"
                    value={formData.numIdGps}
                    onChange={(e) => handleChange("numIdGps", e.target.value)}
                    placeholder="Número identificador del GPS"
                    data-testid="input-numidgps"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador del dispositivo GPS para las remesas.
                  </p>
                </div>
                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-company">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webservice">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Web Service</CardTitle>
                <CardDescription>URLs de conexión al Web Service SOAP del RNDC.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="wsUrlProd">URL Producción</Label>
                  <Input 
                    id="wsUrlProd"
                    value={formData.wsUrlProd}
                    onChange={(e) => handleChange("wsUrlProd", e.target.value)}
                    placeholder="URL del servicio de producción"
                    data-testid="input-url-prod"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wsUrlTest">URL Pruebas</Label>
                  <Input 
                    id="wsUrlTest"
                    value={formData.wsUrlTest}
                    onChange={(e) => handleChange("wsUrlTest", e.target.value)}
                    placeholder="URL del servicio de pruebas"
                    data-testid="input-url-test"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Ambiente Activo</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange("testing")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        formData.wsEnvironment === "testing"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-env-testing"
                    >
                      {formData.wsEnvironment === "testing" && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">Pruebas</div>
                        <div className="text-sm text-muted-foreground">Para desarrollo y testing</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange("production")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        formData.wsEnvironment === "production"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-env-production"
                    >
                      {formData.wsEnvironment === "production" && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">Producción</div>
                        <div className="text-sm text-muted-foreground">Envío real al RNDC</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-amber-800">
                    <strong>Nota:</strong> El ambiente activo actualmente es{" "}
                    <span className="font-bold uppercase text-amber-900">
                      {formData.wsEnvironment === "production" ? "PRODUCCIÓN" : "PRUEBAS"}
                    </span>
                  </p>
                </div>

                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-webservice">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Sistema</CardTitle>
                <CardDescription>Opciones de mantenimiento del servidor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Reiniciar Servidor</Label>
                  <p className="text-sm text-muted-foreground">
                    Reinicie el servidor si experimenta problemas o después de cambios de configuración importantes.
                  </p>
                  <Button 
                    onClick={handleRestart} 
                    variant="destructive"
                    disabled={isRestarting}
                    className="w-full sm:w-auto"
                    data-testid="button-restart-server"
                  >
                    <RotateCcw className={`mr-2 h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} />
                    {isRestarting ? 'Reiniciando...' : 'Reiniciar Servidor'}
                  </Button>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-amber-800">
                    <strong>Nota:</strong> Al reiniciar el servidor, la aplicación estará temporalmente no disponible. 
                    El servidor se reiniciará automáticamente si está configurado con PM2.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
