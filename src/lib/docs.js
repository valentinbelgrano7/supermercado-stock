import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export const DOC_TYPES = {
  ingreso: {
    title: 'Ingresos',
    singular: 'Ingreso',
    path: '/ingresos',
    icon: ArrowDownToLine,
    subtitle: 'Compras a proveedores, devoluciones de clientes y otras entradas de mercadería',
    defaultReason: 'compra',
  },
  egreso: {
    title: 'Egresos',
    singular: 'Egreso',
    path: '/egresos',
    icon: ArrowUpFromLine,
    subtitle: 'Ventas, mermas, vencimientos, consumo interno y devoluciones a proveedores',
    defaultReason: 'venta',
  },
};
