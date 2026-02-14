import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  SectionType
} from 'docx';
import { jsPDF } from 'jspdf';

export interface EvaluationExportResult {
  before: string;
  after: string;
  metrics: { similarity: number; quality: number; relevance: number };
}

export interface EvaluationExportLabels {
  beforeFineTuning: string;
  afterFineTuning: string;
  evaluationMetrics: string;
  similarity: string;
  quality: string;
  relevance: string;
}

type MdBlock = { type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'code'; content: string; items?: string[] };

function parseMarkdownBlocks(text: string): MdBlock[] {
  if (!text || !text.trim()) return [{ type: 'p', content: '' }];
  const blocks: MdBlock[] = [];
  const lines = text.split(/\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const ul = line.match(/^[-*] (.+)$/);
    const ol = line.match(/^\d+\. (.+)$/);
    const codeStart = line.match(/^```/);
    if (h1) {
      blocks.push({ type: 'h1', content: h1[1].trim() });
      i++;
      continue;
    }
    if (h2) {
      blocks.push({ type: 'h2', content: h2[1].trim() });
      i++;
      continue;
    }
    if (h3) {
      blocks.push({ type: 'h3', content: h3[1].trim() });
      i++;
      continue;
    }
    if (ul) {
      const items: string[] = [ul[1]];
      i++;
      while (i < lines.length && /^[-*] (.+)$/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] (.+)$/, '$1'));
        i++;
      }
      blocks.push({ type: 'ul', content: '', items });
      continue;
    }
    if (ol) {
      const items: string[] = [ol[1]];
      i++;
      while (i < lines.length && /^\d+\. (.+)$/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. (.+)$/, '$1'));
        i++;
      }
      blocks.push({ type: 'ol', content: '', items });
      continue;
    }
    if (codeStart) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    blocks.push({ type: 'p', content: line });
    i++;
  }
  return blocks.length ? blocks : [{ type: 'p', content: text.trim() }];
}

function parseInlineToRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(remaining)) !== null) {
    if (m.index > lastIndex) {
      runs.push(new TextRun({ text: remaining.slice(lastIndex, m.index) }));
    }
    const raw = m[1];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      runs.push(new TextRun({ text: raw.slice(2, -2), bold: true }));
    } else if (raw.startsWith('*') && raw.endsWith('*') && !raw.startsWith('**')) {
      runs.push(new TextRun({ text: raw.slice(1, -1), italics: true }));
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      runs.push(new TextRun({ text: raw.slice(1, -1) }));
    } else {
      runs.push(new TextRun({ text: raw }));
    }
    lastIndex = m.index + raw.length;
  }
  if (lastIndex < remaining.length) {
    runs.push(new TextRun({ text: remaining.slice(lastIndex) }));
  }
  if (runs.length === 0 && text) {
    runs.push(new TextRun({ text }));
  }
  return runs;
}

function mdBlocksToDocxParagraphs(blocks: MdBlock[]): Paragraph[] {
  const out: Paragraph[] = [];
  const spacingAfter = 120;
  const spacingAfterHeading = 200;
  for (const b of blocks) {
    switch (b.type) {
      case 'h1':
        out.push(new Paragraph({ text: b.content, heading: HeadingLevel.HEADING_1, spacing: { after: spacingAfterHeading } }));
        break;
      case 'h2':
        out.push(new Paragraph({ text: b.content, heading: HeadingLevel.HEADING_2, spacing: { after: spacingAfterHeading } }));
        break;
      case 'h3':
        out.push(new Paragraph({ text: b.content, heading: HeadingLevel.HEADING_3, spacing: { after: spacingAfterHeading } }));
        break;
      case 'p':
        if (!b.content.trim()) {
          out.push(new Paragraph({ text: ' ', spacing: { after: spacingAfter } }));
        } else {
          const runs = parseInlineToRuns(b.content);
          out.push(new Paragraph({ children: runs, spacing: { after: spacingAfter } }));
        }
        break;
      case 'ul':
        if (b.items) {
          for (const item of b.items) {
            const runs = parseInlineToRuns(item);
            out.push(new Paragraph({ children: [new TextRun({ text: '• ', bold: true }), ...runs], spacing: { after: spacingAfter } }));
          }
        }
        break;
      case 'ol':
        if (b.items) {
          b.items.forEach((item, idx) => {
            const runs = parseInlineToRuns(item);
            out.push(new Paragraph({ children: [new TextRun({ text: `${idx + 1}. `, bold: true }), ...runs], spacing: { after: spacingAfter } }));
          });
        }
        break;
      case 'code':
        out.push(new Paragraph({ children: [new TextRun({ text: b.content, font: 'Consolas' })], spacing: { after: spacingAfter } }));
        break;
    }
  }
  return out;
}

function mdBlocksToDocx(mdText: string): Paragraph[] {
  return mdBlocksToDocxParagraphs(parseMarkdownBlocks(mdText));
}

export async function buildEvaluationDocx(
  result: EvaluationExportResult,
  labels: EvaluationExportLabels
): Promise<Blob> {
  const beforeParas = mdBlocksToDocx(result.before);
  const afterParas = mdBlocksToDocx(result.after);
  const doc = new Document({
    sections: [
      {
        properties: { type: SectionType.CONTINUOUS },
        children: [
          new Paragraph({
            text: labels.beforeFineTuning,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          ...beforeParas,
          new Paragraph({
            text: labels.afterFineTuning,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),
          ...afterParas,
          new Paragraph({
            text: labels.evaluationMetrics,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${labels.similarity}: ${(result.metrics.similarity * 100).toFixed(1)}%`, break: 1 }),
              new TextRun({ text: `${labels.quality}: ${(result.metrics.quality * 100).toFixed(1)}%`, break: 1 }),
              new TextRun({ text: `${labels.relevance}: ${(result.metrics.relevance * 100).toFixed(1)}%` })
            ],
            spacing: { after: 120 }
          })
        ]
      }
    ]
  });
  const buffer = await Packer.toBlob(doc);
  return buffer;
}

const PDF_MARGIN = 20;
const PDF_PAGE_WIDTH = 210;
const PDF_LINE_HEIGHT = 5.5;
const PDF_FONT_SIZE = 11;
const PDF_H1_SIZE = 16;
const PDF_H2_SIZE = 14;
const PDF_H3_SIZE = 12;

function writeMdBlocksToPdf(doc: jsPDF, blocks: MdBlock[], maxWidth: number, startY: number): number {
  let y = startY;
  const pageHeight = 277;

  function checkNewPage(needed: number = PDF_LINE_HEIGHT * 2) {
    if (y + needed > pageHeight) {
      doc.addPage();
      y = PDF_MARGIN;
    }
  }

  for (const b of blocks) {
    switch (b.type) {
      case 'h1':
        doc.setFontSize(PDF_H1_SIZE);
        doc.setFont('helvetica', 'bold');
        checkNewPage(PDF_LINE_HEIGHT * 2);
        doc.text(b.content, PDF_MARGIN, y);
        y += PDF_LINE_HEIGHT * 1.8;
        doc.setFontSize(PDF_FONT_SIZE);
        doc.setFont('helvetica', 'normal');
        break;
      case 'h2':
        doc.setFontSize(PDF_H2_SIZE);
        doc.setFont('helvetica', 'bold');
        checkNewPage(PDF_LINE_HEIGHT * 1.8);
        doc.text(b.content, PDF_MARGIN, y);
        y += PDF_LINE_HEIGHT * 1.5;
        doc.setFontSize(PDF_FONT_SIZE);
        doc.setFont('helvetica', 'normal');
        break;
      case 'h3':
        doc.setFontSize(PDF_H3_SIZE);
        doc.setFont('helvetica', 'bold');
        checkNewPage(PDF_LINE_HEIGHT * 1.5);
        doc.text(b.content, PDF_MARGIN, y);
        y += PDF_LINE_HEIGHT * 1.3;
        doc.setFontSize(PDF_FONT_SIZE);
        doc.setFont('helvetica', 'normal');
        break;
      case 'p':
        doc.setFontSize(PDF_FONT_SIZE);
        doc.setFont('helvetica', 'normal');
        const pLines = doc.splitTextToSize(b.content || ' ', maxWidth);
        for (const line of pLines) {
          checkNewPage();
          doc.text(line, PDF_MARGIN, y);
          y += PDF_LINE_HEIGHT;
        }
        break;
      case 'ul':
      case 'ol':
        doc.setFontSize(PDF_FONT_SIZE);
        doc.setFont('helvetica', 'normal');
        if (b.items) {
          for (let idx = 0; idx < b.items.length; idx++) {
            const prefix = b.type === 'ol' ? `${idx + 1}. ` : '• ';
            const itemLines = doc.splitTextToSize(prefix + b.items[idx], maxWidth);
            for (const line of itemLines) {
              checkNewPage();
              doc.text(line, PDF_MARGIN, y);
              y += PDF_LINE_HEIGHT;
            }
          }
        }
        break;
      case 'code':
        doc.setFontSize(PDF_FONT_SIZE - 1);
        const codeLines = doc.splitTextToSize(b.content || ' ', maxWidth);
        for (const line of codeLines) {
          checkNewPage();
          doc.text(line, PDF_MARGIN, y);
          y += PDF_LINE_HEIGHT;
        }
        doc.setFontSize(PDF_FONT_SIZE);
        break;
    }
  }
  return y;
}

export async function buildEvaluationPdf(
  result: EvaluationExportResult,
  labels: EvaluationExportLabels
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const maxWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  function checkNewPage(needed: number = PDF_LINE_HEIGHT * 2) {
    if (y + needed > 277) {
      doc.addPage();
      y = PDF_MARGIN;
    }
  }

  doc.setFontSize(PDF_H2_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.beforeFineTuning, PDF_MARGIN, y);
  y += PDF_LINE_HEIGHT * 1.5;
  doc.setFontSize(PDF_FONT_SIZE);
  doc.setFont('helvetica', 'normal');

  y = writeMdBlocksToPdf(doc, parseMarkdownBlocks(result.before || ''), maxWidth, y);
  y += PDF_LINE_HEIGHT;

  checkNewPage(PDF_LINE_HEIGHT * 3);
  doc.setFontSize(PDF_H2_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.afterFineTuning, PDF_MARGIN, y);
  y += PDF_LINE_HEIGHT * 1.5;
  doc.setFontSize(PDF_FONT_SIZE);
  doc.setFont('helvetica', 'normal');

  y = writeMdBlocksToPdf(doc, parseMarkdownBlocks(result.after || ''), maxWidth, y);
  y += PDF_LINE_HEIGHT;

  checkNewPage(PDF_LINE_HEIGHT * 3);
  doc.setFontSize(PDF_H2_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.evaluationMetrics, PDF_MARGIN, y);
  y += PDF_LINE_HEIGHT * 1.5;
  doc.setFontSize(PDF_FONT_SIZE);
  doc.setFont('helvetica', 'normal');
  doc.text(`${labels.similarity}: ${(result.metrics.similarity * 100).toFixed(1)}%`, PDF_MARGIN, y);
  y += PDF_LINE_HEIGHT;
  doc.text(`${labels.quality}: ${(result.metrics.quality * 100).toFixed(1)}%`, PDF_MARGIN, y);
  y += PDF_LINE_HEIGHT;
  doc.text(`${labels.relevance}: ${(result.metrics.relevance * 100).toFixed(1)}%`, PDF_MARGIN, y);

  return doc.output('blob');
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64 ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
