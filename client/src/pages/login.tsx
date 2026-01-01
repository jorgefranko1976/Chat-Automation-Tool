import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Truck, LogIn, UserPlus } from "lucide-react";

export default function Login() {
  const { login, register, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    username: "", 
    password: "", 
    confirmPassword: "",
    name: "", 
    email: "" 
  });

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast({ title: "Error", description: "Complete todos los campos", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const result = await login(loginData.username, loginData.password);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Bienvenido", description: "Sesión iniciada correctamente" });
      setLocation("/");
    } else {
      toast({ title: "Error", description: result.message || "Error al iniciar sesión", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.username || !registerData.password) {
      toast({ title: "Error", description: "Usuario y contraseña son requeridos", variant: "destructive" });
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }

    if (registerData.password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      username: registerData.username,
      password: registerData.password,
      name: registerData.name || undefined,
      email: registerData.email || undefined,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Cuenta creada", description: "Bienvenido a RNDC Connect" });
      setLocation("/");
    } else {
      toast({ title: "Error", description: result.message || "Error al crear cuenta", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">RNDC Connect</h1>
          <p className="text-slate-400 mt-2">Sistema de Gestión de Transporte</p>
        </div>

        <Card className="bg-white/95 backdrop-blur">
          <CardHeader>
            <CardTitle>Acceso al Sistema</CardTitle>
            <CardDescription>Inicie sesión o cree una cuenta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">
                  <LogIn className="mr-2 h-4 w-4" /> Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">
                  <UserPlus className="mr-2 h-4 w-4" /> Registrarse
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Usuario</Label>
                    <Input
                      id="login-username"
                      value={loginData.username}
                      onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Ingrese su usuario"
                      autoComplete="username"
                      data-testid="input-login-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Ingrese su contraseña"
                      autoComplete="current-password"
                      data-testid="input-login-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-login">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                    Iniciar Sesión
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nombre</Label>
                      <Input
                        id="register-name"
                        value={registerData.name}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Su nombre"
                        data-testid="input-register-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Correo</Label>
                      <Input
                        id="register-email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="correo@ejemplo.com"
                        data-testid="input-register-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Usuario *</Label>
                    <Input
                      id="register-username"
                      value={registerData.username}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Nombre de usuario"
                      autoComplete="username"
                      data-testid="input-register-username"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña *</Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                        data-testid="input-register-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm">Confirmar *</Label>
                      <Input
                        id="register-confirm"
                        type="password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Repetir contraseña"
                        autoComplete="new-password"
                        data-testid="input-register-confirm"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-register">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Crear Cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          RNDC Connect - Ministerio de Transporte Colombia
        </p>
      </div>
    </div>
  );
}
