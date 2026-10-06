// Motivos válidos por tipo de documento.
export const REASONS = {
  ingreso: {
    compra: 'Compra a proveedor',
    devolucion_cliente: 'Devolución de cliente',
    transferencia: 'Transferencia entrante',
    otro: 'Otro ingreso',
  },
  egreso: {
    venta: 'Venta',
    merma: 'Merma / rotura',
    vencimiento: 'Vencimiento',
    consumo_interno: 'Consumo interno',
    devolucion_proveedor: 'Devolución a proveedor',
    otro: 'Otro egreso',
  },
};

export const DOC_PREFIX = { ingreso: 'ING', egreso: 'EGR' };
