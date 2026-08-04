'use client';

import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminExportPage() {
  return (
    <div>
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administración</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Exportar datos</h1>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Descarga los datos de MinusVigo en formato CSV para análisis externos.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl shadow-elevated">
          <CardHeader>
            <CardTitle>Plazas</CardTitle>
            <CardDescription>Listado completo con estado y confianza actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="btn-cta gap-1.5">
              <a href="/api/admin/export?dataset=spots">
                <Download className="h-4 w-4" /> Descargar CSV
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-elevated">
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
            <CardDescription>Historial completo de reportes de la comunidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="btn-cta gap-1.5">
              <a href="/api/admin/export?dataset=reports">
                <Download className="h-4 w-4" /> Descargar CSV
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
