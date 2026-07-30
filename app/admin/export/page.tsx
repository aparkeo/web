'use client';

import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminExportPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Exportar datos</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plazas</CardTitle>
            <CardDescription>Listado completo con estado y confianza actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-1.5">
              <a href="/api/admin/export?dataset=spots">
                <Download className="h-4 w-4" /> Descargar CSV
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
            <CardDescription>Historial completo de reportes de la comunidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-1.5">
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
