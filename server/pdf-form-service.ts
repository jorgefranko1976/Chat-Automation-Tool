import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const TEMPLATE_PATH = path.join(process.cwd(), 'pdf-templates');

if (!fs.existsSync(TEMPLATE_PATH)) {
  fs.mkdirSync(TEMPLATE_PATH, { recursive: true });
}

export interface ManifiestoData {
  numManifiesto: string;
  idManifiesto: string;
  fechaExpedicion: string;
  fechaRadicacion: string;
  origenViaje: string;
  destinoViaje: string;
  titularNombre: string;
  docTitular: string;
  dirTitular: string;
  telTitular: string;
  ciudadTitular: string;
  placa: string;
  marca: string;
  placaRemolque: string;
  configuracion: string;
  pesoVacio: string;
  compSoat: string;
  nPoliza: string;
  venceSoat: string;
  nombreConductor: string;
  identConductor: string;
  dirConductor: string;
  telConductor: string;
  numLicencia: string;
  ciudadConductor: string;
  poseedorNombre: string;
  docPoseedor: string;
  direccionPoseedor: string;
  telPoseedor: string;
  ciudadPoseedor: string;
  consecutivoRemesa: string;
  cantidad: string;
  valorTotal: string;
  reteFuente: string;
  reteIca: string;
  netoPagar: string;
  valorAnticipo: string;
  saldoPagar: string;
  valorLetras: string;
  fechaSaldo: string;
  qrDataUrl?: string;
}

const fieldMapping: Record<string, keyof ManifiestoData> = {
  'NUM_MANIFIESTO': 'numManifiesto',
  'ID_MANIFIESTO': 'idManifiesto',
  'FECHA_EXP': 'fechaExpedicion',
  'FECH_RAD': 'fechaRadicacion',
  'ORIGEN_VIAJE': 'origenViaje',
  'DESTINO_VIAJE': 'destinoViaje',
  'TITULA_NOM': 'titularNombre',
  'DOC_TITULAR': 'docTitular',
  'DIR_TITULAR': 'dirTitular',
  'TEL_TITULAR': 'telTitular',
  'CIUDAD_TITULAR': 'ciudadTitular',
  'PLACA': 'placa',
  'MARCA': 'marca',
  'PLACA_REMOLQUE': 'placaRemolque',
  'CONFIG': 'configuracion',
  'PESO_VACIO': 'pesoVacio',
  'COMP_SOAT': 'compSoat',
  'N_POLIZA': 'nPoliza',
  'VENCE_SOAT': 'venceSoat',
  'NOM_CONDUCTOR': 'nombreConductor',
  'IDENT_CONDUCTOR': 'identConductor',
  'DIR_CONTUCTOR': 'dirConductor',
  'DIR_CONDUCTOR': 'dirConductor',
  'TEL_CONDUCTOR': 'telConductor',
  'NUM_LICENCIA': 'numLicencia',
  'CIUDAD_CONDUCTOR': 'ciudadConductor',
  'POSEEDOR_NOM': 'poseedorNombre',
  'DOC_POSEEDOR': 'docPoseedor',
  'DIRECCION_POSEEDOR': 'direccionPoseedor',
  'TEL_POSEEDOR': 'telPoseedor',
  'CIUDAD_POSEEDOR': 'ciudadPoseedor',
  'CONSECUTIVO_MANIFIESTO': 'consecutivoRemesa',
  'CONSECUTIVO_REMESA': 'consecutivoRemesa',
  'CANTIDAD': 'cantidad',
  'VALOR_TOTAL': 'valorTotal',
  'RETE_FUENTE': 'reteFuente',
  'RETE_ICA': 'reteIca',
  'NETO_PAGAR': 'netoPagar',
  'VALOR_ANTICIPO': 'valorAnticipo',
  'SALDO_PAGAR': 'saldoPagar',
  'VALOR_LETRAS': 'valorLetras',
  'FECHA_SALDO': 'fechaSaldo',
  'NUM_MANIFIESTO_2D': 'numManifiesto',
  'NOMBRE_CONDCTOR': 'nombreConductor',
  'NOMBRE_CONDUCTOR': 'nombreConductor',
  'ID_COND': 'identConductor',
  'ID_MANIFIESTO_2D': 'idManifiesto',
  'NUM_MANIFIESTO_SEG_H': 'numManifiesto',
};

export async function saveFormTemplate(fileBuffer: Buffer, templateName: string): Promise<string> {
  const fileName = `${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const filePath = path.join(TEMPLATE_PATH, fileName);
  fs.writeFileSync(filePath, fileBuffer);
  return fileName;
}

export async function listFormTemplates(): Promise<string[]> {
  if (!fs.existsSync(TEMPLATE_PATH)) return [];
  return fs.readdirSync(TEMPLATE_PATH).filter(f => f.endsWith('.pdf'));
}

export async function getTemplateFields(templateName: string): Promise<string[]> {
  const filePath = path.join(TEMPLATE_PATH, templateName);
  if (!fs.existsSync(filePath)) {
    throw new Error('Template not found');
  }
  
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  return fields.map(field => field.getName());
}

export async function fillFormPdf(
  templateName: string, 
  data: ManifiestoData,
  qrImageBytes?: Uint8Array,
  qrPosition?: { rightMargin: number; topMargin: number; sizeMm: number; page: number }
): Promise<Uint8Array> {
  const filePath = path.join(TEMPLATE_PATH, templateName);
  if (!fs.existsSync(filePath)) {
    throw new Error('Template not found');
  }
  
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  for (const field of fields) {
    const fieldName = field.getName();
    const dataKey = fieldMapping[fieldName];
    
    if (dataKey && data[dataKey]) {
      try {
        const textField = form.getTextField(fieldName);
        textField.setText(String(data[dataKey]));
      } catch (e) {
        console.log(`Could not fill field ${fieldName}:`, e);
      }
    }
  }
  
  if (qrImageBytes && qrPosition) {
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const pages = pdfDoc.getPages();
    const targetPage = pages[qrPosition.page - 1];
    
    if (targetPage) {
      const { width, height } = targetPage.getSize();
      // Convert mm to points (1mm = 2.835 points)
      const mmToPoints = 2.835;
      const qrSizePoints = qrPosition.sizeMm * mmToPoints;
      const rightMarginPoints = qrPosition.rightMargin * mmToPoints;
      const topMarginPoints = qrPosition.topMargin * mmToPoints;
      
      // Calculate x from right edge, y from top edge
      const x = width - rightMarginPoints - qrSizePoints;
      const y = height - topMarginPoints - qrSizePoints;
      
      targetPage.drawImage(qrImage, {
        x: x,
        y: y,
        width: qrSizePoints,
        height: qrSizePoints,
      });
    }
  }
  
  form.flatten();
  
  return await pdfDoc.save();
}

export async function fillFormPdfFromBase64(
  templateName: string, 
  data: ManifiestoData,
  qrDataUrl?: string,
  qrPosition?: { rightMargin: number; topMargin: number; sizeMm: number; page: number }
): Promise<Uint8Array> {
  let qrImageBytes: Uint8Array | undefined;
  
  if (qrDataUrl) {
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    qrImageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
  }
  
  return fillFormPdf(templateName, data, qrImageBytes, qrPosition);
}

export function getDefaultQrPosition() {
  // 4cm x 4cm QR, 2cm from top, 2cm from right edge
  return { rightMargin: 20, topMargin: 20, sizeMm: 40, page: 1 };
}
